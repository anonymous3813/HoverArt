<script lang="ts">import { createEventDispatcher } from 'svelte';
import type { Skill } from '$lib/types/skill';
import { omniAPI } from '$lib/services/omniAPI';
import { generateSkillDescription } from '$lib/utils/skillUtils';
const dispatch = createEventDispatcher();
export let currentTask: string = '';
export let skills: Skill[] = [];
let executionLog: string[] = [];
let isExecuting = false;
let currentPhase: 'planning' | 'acting' | 'reflecting' | null = null;
$: if (currentTask && !isExecuting) {
    executeTask(currentTask);
}
async function executeTask(task: string) {
    if (!task || isExecuting)
        return;
    isExecuting = true;
    dispatch('taskStart');
    try {
        const existingSkill = findMatchingSkill(task, skills);
        let aiResponse;
        if (existingSkill && existingSkill.executionPlan) {
            currentPhase = 'planning';
            logMessage(`📋 Planning Phase: Found existing skill "${existingSkill.name}"`);
            logMessage(`♻️ Reusing learned execution plan`);
            logMessage(`✓ This task has been performed ${existingSkill.metadata?.timesUsed || 1} time(s) before`);
            aiResponse = {
                success: true,
                actions: existingSkill.executionPlan.actions,
                explanation: `Using learned skill: ${existingSkill.name}`,
                skillSuggestion: null
            };
            updateSkillUsage(existingSkill.id);
            logMessage(`✓ Execution plan loaded from skill tree`);
            logMessage(`✓ Actions: ${aiResponse.actions.length}`);
        }
        else {
            currentPhase = 'planning';
            logMessage(`📋 Planning Phase: Analyzing new task "${task}"`);
            aiResponse = await omniAPI.analyzeTask({
                task,
                skills: skills.filter(s => s.unlocked)
            });
            if (!aiResponse.success) {
                throw new Error('Task analysis failed');
            }
            logMessage(`✓ Plan created: ${aiResponse.explanation}`);
            logMessage(`✓ Identified ${aiResponse.actions.length} action(s) to perform`);
        }
        currentPhase = 'acting';
        const actionResults: any[] = [];
        for (let i = 0; i < aiResponse.actions.length; i++) {
            const action = aiResponse.actions[i];
            logMessage(`⚡ Acting Phase [${i + 1}/${aiResponse.actions.length}]: Executing ${action.type} operation`);
            const result = await omniAPI.executeAction(action);
            actionResults.push(result);
            if (result.success) {
                logMessage(`✓ ${result.message}`);
            }
            else {
                logMessage(`✗ Failed: ${result.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        currentPhase = 'reflecting';
        logMessage(`🔍 Reflecting Phase: Evaluating task execution`);
        const allSuccessful = actionResults.every(r => r.success);
        if (allSuccessful) {
            logMessage(`✓ All actions completed successfully`);
            let learnedSkill = null;
            if (!existingSkill) {
                learnedSkill = determineNewSkill(task, aiResponse.actions, aiResponse.skillSuggestion);
                if (learnedSkill) {
                    learnedSkill.executionPlan = {
                        originalTask: task,
                        actions: aiResponse.actions,
                        keywords: extractKeywords(task)
                    };
                    logMessage(`🎓 New skill learned: "${learnedSkill.name}"`);
                    logMessage(`📈 Skill tree has grown!`);
                    logMessage(`💾 Execution plan saved for future use`);
                }
                else {
                    logMessage(`💡 Task completed using existing skills`);
                }
            }
            else {
                logMessage(`♻️ Task completed using learned skill: "${existingSkill.name}"`);
                logMessage(`⚡ Execution was faster due to reused plan`);
            }
            logMessage(`✅ Task completed successfully!`);
            dispatch('taskComplete', {
                task,
                success: true,
                learnedSkill
            });
        }
        else {
            logMessage(`⚠️ Some actions failed`);
            throw new Error('Task partially failed');
        }
    }
    catch (error) {
        logMessage(`❌ Task failed: ${error}`);
        currentPhase = 'reflecting';
        logMessage(`🔍 Reflecting: Analyzing failure...`);
        logMessage(`💡 Suggestion: Try rephrasing the task or breaking it into smaller steps`);
        dispatch('taskComplete', {
            task,
            success: false
        });
    }
    finally {
        isExecuting = false;
        currentPhase = null;
        dispatch('taskEnd');
    }
}
function determineNewSkill(task: string, actions: any[], suggestion: any): Partial<Skill> | null {
    const taskLower = task.toLowerCase();
    const trivialKeywords = ['what', 'time', 'date', 'hello', 'hi'];
    if (trivialKeywords.some(kw => taskLower.startsWith(kw))) {
        return null;
    }
    const existingSkill = skills.find(s => {
        const nameSimilarity = calculateSimilarity(s.name.toLowerCase(), taskLower);
        return nameSimilarity > 0.6;
    });
    if (existingSkill) {
        logMessage(`📚 Similar skill already exists: "${existingSkill.name}"`);
        return null;
    }
    if (suggestion) {
        return {
            name: suggestion.name,
            description: suggestion.description,
            actions: actions.map(a => `${a.type}: ${a.operation}`),
            executionPlan: {
                originalTask: task,
                actions: actions,
                keywords: extractKeywords(task)
            }
        };
    }
    if (actions.length > 0) {
        return {
            name: generateSkillName(task),
            description: generateSkillDescription(task, actions.map(a => `${a.type}.${a.operation}`)),
            actions: actions.map(a => `${a.type}: ${a.operation}`),
            executionPlan: {
                originalTask: task,
                actions: actions,
                keywords: extractKeywords(task)
            }
        };
    }
    return null;
}
function generateSkillName(task: string): string {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'to', 'from', 'for', 'with', 'on', 'at', 'in'];
    const words = task.split(' ')
        .filter(w => w.length > 3 && !stopWords.includes(w.toLowerCase()))
        .slice(0, 3);
    if (words.length > 0) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    return 'New Skill';
}
function calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}
function logMessage(message: string) {
    executionLog = [...executionLog, `[${new Date().toLocaleTimeString()}] ${message}`];
    setTimeout(() => {
        const container = document.querySelector('.log-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, 100);
    if (executionLog.length > 100) {
        executionLog = executionLog.slice(-100);
    }
}
function clearLog() {
    executionLog = [];
}
function findMatchingSkill(task: string, skills: Skill[]): Skill | null {
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(' ').filter(w => w.length > 3);
    for (const skill of skills) {
        if (!skill.executionPlan || !skill.unlocked)
            continue;
        const keywords = skill.executionPlan.keywords || [];
        const matches = taskWords.filter(word => keywords.some(kw => kw.includes(word) || word.includes(kw)));
        if (matches.length / taskWords.length > 0.6) {
            return skill;
        }
        const originalTask = skill.executionPlan.originalTask.toLowerCase();
        const similarity = calculateSimilarity(taskLower, originalTask);
        if (similarity > 0.7) {
            return skill;
        }
    }
    return null;
}
function extractKeywords(task: string): string[] {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'to', 'from', 'for', 'with', 'on', 'at', 'in', 'is', 'are', 'was', 'were', 'be'];
    return task.toLowerCase()
        .split(' ')
        .filter(word => word.length > 3 && !stopWords.includes(word));
}
function updateSkillUsage(skillId: string) {
    const skillIndex = skills.findIndex(s => s.id === skillId);
    if (skillIndex === -1)
        return;
    const skill = skills[skillIndex];
    const metadata = skill.metadata || { timesUsed: 0, successRate: 1 };
    skills[skillIndex] = {
        ...skill,
        metadata: {
            ...metadata,
            timesUsed: (metadata.timesUsed || 0) + 1,
            lastUsed: new Date()
        }
    };
}
</script>

<div class="task-executor">
  <div class="executor-header">
    <h3>Execution Log</h3>
    {#if currentPhase}
      <span class="phase-indicator phase-{currentPhase}">
        {currentPhase === 'planning' ? '📋 Planning' : 
         currentPhase === 'acting' ? '⚡ Acting' : 
         '🔍 Reflecting'}
      </span>
    {/if}
    <button class="clear-btn" on:click={clearLog}>Clear</button>
  </div>
  
  <div class="log-container">
    {#if executionLog.length === 0}
      <p class="empty-log">No tasks executed yet...</p>
      <p class="empty-hint">Speak to Omni to start executing tasks!</p>
    {:else}
      {#each executionLog as logEntry}
        <div class="log-entry">{logEntry}</div>
      {/each}
    {/if}
  </div>
  
  {#if isExecuting}
    <div class="executing-indicator">
      <div class="spinner"></div>
      <span>Executing...</span>
    </div>
  {/if}
</div>

<style>
  .task-executor {
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(255,255,255,0.07);
    background: rgba(0,0,0,0.2);
    flex: 1;
    overflow: hidden;
  }

  .executor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .executor-header h3 {
    font-size: 0.85rem;
    font-weight: 700;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .phase-indicator {
    font-size: 0.75rem;
    padding: 0.4rem 0.8rem;
    border-radius: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .phase-planning {
    background: rgba(0,245,255,0.1);
    color: #00f5ff;
    border: 1px solid rgba(0,245,255,0.3);
  }

  .phase-acting {
    background: rgba(255,78,205,0.1);
    color: #ff4ecd;
    border: 1px solid rgba(255,78,205,0.3);
  }

  .phase-reflecting {
    background: rgba(167,139,250,0.1);
    color: #a78bfa;
    border: 1px solid rgba(167,139,250,0.3);
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .clear-btn {
    font-size: 0.7rem;
    padding: 0.4rem 0.8rem;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .clear-btn:hover {
    border-color: #00f5ff;
    color: #00f5ff;
  }

  .log-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
  }

  .empty-log {
    color: rgba(255,255,255,0.25);
    font-style: italic;
    text-align: center;
    padding: 2rem 2rem 0.5rem;
    font-size: 0.85rem;
  }

  .empty-hint {
    color: rgba(255,255,255,0.15);
    font-size: 0.7rem;
    text-align: center;
    padding: 0 2rem 2rem;
  }

  .log-entry {
    color: rgba(255,255,255,0.6);
    line-height: 1.5;
    padding: 0.5rem;
    background: rgba(0,245,255,0.02);
    border-left: 2px solid rgba(0,245,255,0.3);
    border-radius: 2px;
  }

  .executing-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255,78,205,0.05);
    border-top: 1px solid rgba(255,78,205,0.2);
    color: #ff4ecd;
    font-size: 0.85rem;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,78,205,0.2);
    border-top-color: #ff4ecd;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .log-container::-webkit-scrollbar {
    width: 6px;
  }

  .log-container::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.02);
  }

  .log-container::-webkit-scrollbar-thumb {
    background: rgba(0,245,255,0.2);
    border-radius: 3px;
  }

  .log-container::-webkit-scrollbar-thumb:hover {
    background: rgba(0,245,255,0.4);
  }
</style>
