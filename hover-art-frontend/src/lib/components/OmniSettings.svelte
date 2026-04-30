<script lang="ts">import { onMount } from 'svelte';
let showSettings = false;
let apiProvider: 'mock' | 'openai' | 'anthropic' = 'mock';
let apiKey = '';
let voiceRate = 1.1;
let voicePitch = 1.0;
let autoSpeak = true;
let showVisualizer = true;
let darkMode = true;
onMount(() => {
    loadSettings();
});
function loadSettings() {
    const stored = localStorage.getItem('omni-settings');
    if (stored) {
        const settings = JSON.parse(stored);
        apiProvider = settings.apiProvider || 'mock';
        voiceRate = settings.voiceRate || 1.1;
        voicePitch = settings.voicePitch || 1.0;
        autoSpeak = settings.autoSpeak !== false;
        showVisualizer = settings.showVisualizer !== false;
        darkMode = settings.darkMode !== false;
    }
}
function saveSettings() {
    const settings = {
        apiProvider,
        voiceRate,
        voicePitch,
        autoSpeak,
        showVisualizer,
        darkMode
    };
    localStorage.setItem('omni-settings', JSON.stringify(settings));
    if (apiKey) {
        sessionStorage.setItem('omni-api-key', apiKey);
    }
    showSettings = false;
}
function toggleSettings() {
    showSettings = !showSettings;
}
function resetToDefaults() {
    apiProvider = 'mock';
    apiKey = '';
    voiceRate = 1.1;
    voicePitch = 1.0;
    autoSpeak = true;
    showVisualizer = true;
    darkMode = true;
}
</script>

<button class="settings-trigger" on:click={toggleSettings}>
  ⚙️
</button>

{#if showSettings}
  <div class="settings-overlay" on:click={toggleSettings}>
    <div class="settings-panel" on:click|stopPropagation>
      <div class="panel-header">
        <h2>⚙️ Settings</h2>
        <button class="close-btn" on:click={toggleSettings}>×</button>
      </div>
      
      <div class="settings-content">
        
        <section class="settings-section">
          <h3>AI Provider</h3>
          <p class="section-desc">Choose how Omni processes tasks</p>
          
          <div class="provider-options">
            <label class="radio-option">
              <input type="radio" bind:group={apiProvider} value="mock" />
              <span class="radio-label">
                <span class="radio-title">Mock (Default)</span>
                <span class="radio-desc">Rule-based local processing</span>
              </span>
            </label>
            
            <label class="radio-option">
              <input type="radio" bind:group={apiProvider} value="openai" />
              <span class="radio-label">
                <span class="radio-title">OpenAI</span>
                <span class="radio-desc">Use GPT-4 for advanced understanding</span>
              </span>
            </label>
            
            <label class="radio-option">
              <input type="radio" bind:group={apiProvider} value="anthropic" />
              <span class="radio-label">
                <span class="radio-title">Anthropic Claude</span>
                <span class="radio-desc">Use Claude for task execution</span>
              </span>
            </label>
          </div>
          
          {#if apiProvider !== 'mock'}
            <div class="api-key-input">
              <label for="apiKey">API Key</label>
              <input 
                id="apiKey"
                type="password" 
                bind:value={apiKey}
                placeholder="Enter your API key"
              />
              <p class="input-hint">Your API key is stored in session storage only</p>
            </div>
          {/if}
        </section>
        
        
        <section class="settings-section">
          <h3>Voice Settings</h3>
          
          <div class="setting-item">
            <label for="voiceRate">Speech Rate: {voiceRate.toFixed(1)}x</label>
            <input 
              id="voiceRate"
              type="range" 
              bind:value={voiceRate}
              min="0.5"
              max="2.0"
              step="0.1"
            />
          </div>
          
          <div class="setting-item">
            <label for="voicePitch">Speech Pitch: {voicePitch.toFixed(1)}</label>
            <input 
              id="voicePitch"
              type="range" 
              bind:value={voicePitch}
              min="0.5"
              max="2.0"
              step="0.1"
            />
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={autoSpeak} />
              <span>Auto-speak responses</span>
            </label>
          </div>
        </section>
        
        
        <section class="settings-section">
          <h3>Display</h3>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={showVisualizer} />
              <span>Show audio visualizer</span>
            </label>
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={darkMode} />
              <span>Dark mode</span>
            </label>
          </div>
        </section>
      </div>
      
      <div class="panel-footer">
        <button class="reset-btn" on:click={resetToDefaults}>
          Reset to Defaults
        </button>
        <button class="save-btn" on:click={saveSettings}>
          Save Settings
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-trigger {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 56px;
    height: 56px;
    background: rgba(0,245,255,0.1);
    border: 2px solid rgba(0,245,255,0.3);
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.3s;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-trigger:hover {
    background: rgba(0,245,255,0.2);
    border-color: rgba(0,245,255,0.6);
    transform: rotate(45deg);
  }

  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 0.3s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings-panel {
    position: relative;
    width: 90%;
    max-width: 600px;
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

  .panel-header {
    padding: 2rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header h2 {
    font-family: 'Syne', sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    color: white;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 2rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    color: #ff4ecd;
    transform: rotate(90deg);
  }

  .settings-content {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .settings-section h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    margin-bottom: 0.5rem;
  }

  .section-desc {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.5);
    margin-bottom: 1rem;
  }

  .provider-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .radio-option:hover {
    background: rgba(0,245,255,0.05);
    border-color: rgba(0,245,255,0.3);
  }

  .radio-option input[type="radio"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .radio-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .radio-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: white;
  }

  .radio-desc {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
  }

  .api-key-input {
    margin-top: 1rem;
  }

  .api-key-input label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    margin-bottom: 0.5rem;
  }

  .api-key-input input {
    width: 100%;
    padding: 0.75rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    color: white;
    font-family: 'Space Mono', monospace;
    font-size: 0.85rem;
  }

  .input-hint {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.3);
    margin-top: 0.5rem;
  }

  .setting-item {
    margin-bottom: 1.5rem;
  }

  .setting-item label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    margin-bottom: 0.5rem;
  }

  .setting-item input[type="range"] {
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    outline: none;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .checkbox-label span {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.7);
  }

  .panel-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .reset-btn,
  .save-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-family: 'Space Mono', monospace;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.6);
  }

  .reset-btn:hover {
    border-color: #ff4ecd;
    color: #ff4ecd;
  }

  .save-btn {
    background: #00f5ff;
    color: #070710;
  }

  .save-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,245,255,0.4);
  }
</style>
