import type { Skill } from '$lib/types/skill';
export function generateSkillId(): string {
    return `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
export function getSkillColor(category: string): string {
    const colorMap: Record<string, string> = {
        'file': '#ff4ecd',
        'web': '#a78bfa',
        'system': '#fbbf24',
        'calculate': '#34d399',
        'media': '#f87171',
        'communication': '#60a5fa',
        'automation': '#fb923c'
    };
    return colorMap[category] || '#00f5ff';
}
export function categorizeSkill(skillName: string): string {
    const name = skillName.toLowerCase();
    if (name.includes('file') || name.includes('document') || name.includes('save')) {
        return 'file';
    }
    if (name.includes('web') || name.includes('search') || name.includes('browse')) {
        return 'web';
    }
    if (name.includes('system') || name.includes('time') || name.includes('screenshot')) {
        return 'system';
    }
    if (name.includes('calculate') || name.includes('math') || name.includes('compute')) {
        return 'calculate';
    }
    if (name.includes('image') || name.includes('video') || name.includes('audio')) {
        return 'media';
    }
    return 'generic';
}
export function calculateSkillLevel(skill: Skill, allSkills: Skill[]): number {
    if (!skill.parent)
        return 0;
    const parent = allSkills.find(s => s.id === skill.parent);
    if (!parent)
        return 1;
    return parent.level + 1;
}
export function findSkillPath(skillId: string, skills: Skill[]): Skill[] {
    const path: Skill[] = [];
    let current = skills.find(s => s.id === skillId);
    while (current) {
        path.unshift(current);
        if (current.parent) {
            current = skills.find(s => s.id === current!.parent);
        }
        else {
            break;
        }
    }
    return path;
}
export function getChildSkills(parentId: string, skills: Skill[]): Skill[] {
    return skills.filter(s => s.parent === parentId);
}
export function getSkillTreeDepth(skills: Skill[]): number {
    return Math.max(...skills.map(s => s.level), 0);
}
export function getSkillsByCategory(skills: Skill[]): Record<string, Skill[]> {
    const categories: Record<string, Skill[]> = {};
    skills.forEach(skill => {
        const category = categorizeSkill(skill.name);
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(skill);
    });
    return categories;
}
export function canUnlockSkill(skill: Skill, unlockedSkills: Skill[]): boolean {
    if (skill.unlocked)
        return false;
    if (!skill.parent)
        return true;
    const parent = unlockedSkills.find(s => s.id === skill.parent);
    return !!parent && parent.unlocked;
}
export function exportSkillTree(skills: Skill[]): string {
    return JSON.stringify(skills, null, 2);
}
export function importSkillTree(jsonString: string): Skill[] {
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [];
    }
    catch {
        return [];
    }
}
export function generateSkillDescription(taskDescription: string, actions: string[]): string {
    return `Learned from task: "${taskDescription}". Can perform: ${actions.join(', ')}.`;
}
export function updateSkillMetadata(skill: Skill, success: boolean): Skill {
    const metadata = skill.metadata || { timesUsed: 0, successRate: 1 };
    return {
        ...skill,
        metadata: {
            ...metadata,
            timesUsed: (metadata.timesUsed || 0) + 1,
            lastUsed: new Date(),
            successRate: success
                ? ((metadata.successRate || 1) * (metadata.timesUsed || 0) + 1) / ((metadata.timesUsed || 0) + 1)
                : ((metadata.successRate || 1) * (metadata.timesUsed || 0)) / ((metadata.timesUsed || 0) + 1)
        }
    };
}
export function getSkillStats(skills: Skill[]): {
    total: number;
    unlocked: number;
    maxLevel: number;
    categories: number;
    totalUsage: number;
} {
    const unlockedSkills = skills.filter(s => s.unlocked);
    const categories = new Set(skills.map(s => categorizeSkill(s.name)));
    const totalUsage = skills.reduce((sum, s) => sum + (s.metadata?.timesUsed || 0), 0);
    return {
        total: skills.length,
        unlocked: unlockedSkills.length,
        maxLevel: getSkillTreeDepth(skills),
        categories: categories.size,
        totalUsage
    };
}
