<script lang="ts">import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();
let showQuickStart = true;
const exampleTasks = [
    {
        category: 'File Operations',
        tasks: [
            'Create a new document',
            'Save my notes',
            'Open the file manager'
        ]
    },
    {
        category: 'Web Actions',
        tasks: [
            'Search for AI research papers',
            'Find information about quantum computing',
            'Look up the weather forecast'
        ]
    },
    {
        category: 'System Control',
        tasks: [
            'What time is it?',
            'Take a screenshot',
            'Show system information'
        ]
    },
    {
        category: 'Calculations',
        tasks: [
            'Calculate 25 times 17',
            'What is 1024 divided by 8',
            'Compute 45 plus 78'
        ]
    }
];
function tryExample(task: string) {
    dispatch('tryTask', task);
    showQuickStart = false;
}
function dismiss() {
    showQuickStart = false;
}
</script>

{#if showQuickStart}
  <div class="quick-start-overlay" on:click={dismiss}>
    <div class="quick-start-panel" on:click|stopPropagation>
      <button class="close-btn" on:click={dismiss}>×</button>
      
      <div class="panel-header">
        <h2>🚀 Quick Start Guide</h2>
        <p>Welcome to Omni! Here's how to get started:</p>
      </div>
      
      <div class="steps-section">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Click "Speak to Omni"</h3>
            <p>Allow microphone access when prompted</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Speak Your Command</h3>
            <p>Say what you want Omni to do</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Watch the Magic</h3>
            <p>Omni will execute the task and grow its skill tree</p>
          </div>
        </div>
      </div>
      
      <div class="examples-section">
        <h3>Try These Examples:</h3>
        <div class="examples-grid">
          {#each exampleTasks as category}
            <div class="example-category">
              <h4>{category.category}</h4>
              <div class="example-tasks">
                {#each category.tasks as task}
                  <button 
                    class="example-task"
                    on:click={() => tryExample(task)}
                  >
                    <span class="task-icon">▸</span>
                    {task}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="panel-footer">
        <button class="got-it-btn" on:click={dismiss}>
          Got it, Let's Go! →
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-start-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .quick-start-panel {
    position: relative;
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    background: #0d0d1a;
    border: 1px solid rgba(0,245,255,0.3);
    border-radius: 12px;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: slideUp 0.4s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 2rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .close-btn:hover {
    color: #ff4ecd;
    transform: rotate(90deg);
  }

  .panel-header {
    padding: 3rem 3rem 2rem;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .panel-header h2 {
    font-family: 'Syne', sans-serif;
    font-size: 2rem;
    font-weight: 900;
    color: white;
    margin-bottom: 0.75rem;
  }

  .panel-header p {
    font-size: 0.95rem;
    color: rgba(255,255,255,0.5);
  }

  .steps-section {
    padding: 2rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .step {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .step-number {
    width: 48px;
    height: 48px;
    background: rgba(0,245,255,0.1);
    border: 2px solid rgba(0,245,255,0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Syne', sans-serif;
    font-size: 1.3rem;
    font-weight: 900;
    color: #00f5ff;
    flex-shrink: 0;
  }

  .step-content h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    margin-bottom: 0.5rem;
  }

  .step-content p {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.5);
    line-height: 1.6;
  }

  .examples-section {
    padding: 2rem 3rem;
  }

  .examples-section > h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1.2rem;
    font-weight: 800;
    color: white;
    margin-bottom: 1.5rem;
  }

  .examples-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .example-category h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 0.75rem;
  }

  .example-tasks {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .example-task {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: rgba(255,255,255,0.7);
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .example-task:hover {
    background: rgba(0,245,255,0.05);
    border-color: rgba(0,245,255,0.3);
    color: #00f5ff;
    transform: translateX(4px);
  }

  .task-icon {
    color: #00f5ff;
    font-size: 0.9rem;
  }

  .panel-footer {
    padding: 2rem 3rem;
    display: flex;
    justify-content: center;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .got-it-btn {
    padding: 1rem 3rem;
    background: #00f5ff;
    color: #070710;
    border: none;
    border-radius: 6px;
    font-family: 'Space Mono', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 30px rgba(0,245,255,0.3);
  }

  .got-it-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(0,245,255,0.5);
  }

  @media (max-width: 768px) {
    .quick-start-panel {
      width: 95%;
      max-height: 95vh;
    }

    .panel-header,
    .steps-section,
    .examples-section,
    .panel-footer {
      padding: 1.5rem;
    }

    .examples-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style>
