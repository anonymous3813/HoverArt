export interface Skill {
    id: string;
    name: string;
    description: string;
    level: number;
    parent?: string;
    children?: string[];
    unlocked: boolean;
    color: string;
    actions?: string[];
    executionPlan?: {
        originalTask: string;
        actions: TaskAction[];
        keywords: string[];
    };
    metadata?: {
        timesUsed?: number;
        lastUsed?: Date;
        successRate?: number;
    };
}
export interface TaskExecution {
    task: string;
    success: boolean;
    timestamp: Date;
    actions: TaskAction[];
    learnedSkill?: Partial<Skill>;
}
export interface TaskAction {
    type: 'file' | 'web' | 'system' | 'generic';
    operation: string;
    details: string;
    result?: any;
}
