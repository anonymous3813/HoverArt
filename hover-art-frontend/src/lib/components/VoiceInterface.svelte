<script lang="ts">import { onMount, createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();
export let currentTask: string = '';
export let isListening: boolean = false;
export let isProcessing: boolean = false;
let recognition: any = null;
let synthesis: any = null;
let visualizerData: number[] = Array(32).fill(0);
let transcript: string = '';
let confidence: number = 0;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animationFrame: number;
onMount(() => {
    initializeSpeechRecognition();
    initializeAudioVisualizer();
    return () => {
        if (recognition) {
            recognition.stop();
        }
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        if (audioContext) {
            audioContext.close();
        }
    };
});
function initializeSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => {
        isListening = true;
        transcript = '';
    };
    recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
                finalTranscript += result[0].transcript;
                confidence = result[0].confidence;
            }
            else {
                interimTranscript += result[0].transcript;
            }
        }
        transcript = finalTranscript || interimTranscript;
        if (finalTranscript) {
            currentTask = finalTranscript;
            dispatch('taskSubmit', finalTranscript);
        }
    };
    recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
    };
    recognition.onend = () => {
        isListening = false;
    };
    synthesis = window.speechSynthesis;
}
async function initializeAudioVisualizer() {
    try {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        visualize();
    }
    catch (error) {
        console.error('Audio visualizer error:', error);
    }
}
function visualize() {
    if (!analyser)
        return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    visualizerData = Array.from(dataArray).slice(0, 32).map(v => v / 255);
    animationFrame = requestAnimationFrame(visualize);
}
function toggleListening() {
    if (!recognition) {
        alert('Speech recognition not supported in your browser');
        return;
    }
    if (isListening) {
        recognition.stop();
    }
    else {
        recognition.start();
    }
}
function speak(text: string) {
    if (!synthesis)
        return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    synthesis.speak(utterance);
}
export function speakResponse(text: string) {
    speak(text);
}
</script>

<div class="voice-interface">
  
  <div class="visualizer" class:active={isListening}>
    <div class="visualizer-bars">
      {#each visualizerData as value, i}
        <div 
          class="bar" 
          style="height: {Math.max(5, value * 100)}%; opacity: {0.3 + value * 0.7}"
        ></div>
      {/each}
    </div>
    
    {#if isListening}
      <div class="pulse-ring"></div>
      <div class="pulse-ring" style="animation-delay: 0.5s;"></div>
    {/if}
  </div>
  
  
  <div class="status-display">
    {#if isListening}
      <div class="status listening">
        <span class="status-icon">🎤</span>
        <span>Listening...</span>
      </div>
    {:else if isProcessing}
      <div class="status processing">
        <span class="status-icon">⚡</span>
        <span>Processing...</span>
      </div>
    {:else}
      <div class="status idle">
        <span class="status-icon">💤</span>
        <span>Ready</span>
      </div>
    {/if}
  </div>
  
  
  {#if transcript}
    <div class="transcript">
      <div class="transcript-label">You said:</div>
      <div class="transcript-text">{transcript}</div>
      {#if confidence > 0}
        <div class="confidence">
          Confidence: {(confidence * 100).toFixed(0)}%
        </div>
      {/if}
    </div>
  {/if}
  
  
  <button 
    class="voice-button" 
    class:listening={isListening}
    class:disabled={isProcessing}
    on:click={toggleListening}
    disabled={isProcessing}
  >
    <span class="button-icon">{isListening ? '■' : '▶'}</span>
    <span class="button-text">
      {isListening ? 'Stop' : 'Speak to Omni'}
    </span>
  </button>
  
  
  <div class="instructions">
    <p><strong>Voice Commands:</strong></p>
    <ul>
      <li>"Open a new file"</li>
      <li>"Search for AI papers"</li>
      <li>"Show me system information"</li>
      <li>"Take a screenshot"</li>
    </ul>
  </div>
</div>

<style>
  .voice-interface {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    gap: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }

  .visualizer {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%);
    border: 2px solid rgba(0,245,255,0.2);
    transition: all 0.3s;
  }

  .visualizer.active {
    border-color: rgba(0,245,255,0.6);
    box-shadow: 0 0 40px rgba(0,245,255,0.3);
  }

  .visualizer-bars {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 3px;
    height: 80px;
    width: 120px;
  }

  .bar {
    width: 3px;
    background: linear-gradient(to top, #00f5ff, #a78bfa);
    border-radius: 2px;
    transition: height 0.1s, opacity 0.1s;
  }

  .pulse-ring {
    position: absolute;
    inset: -20px;
    border: 2px solid rgba(0,245,255,0.4);
    border-radius: 50%;
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(1.3);
      opacity: 0;
    }
  }

  .status-display {
    width: 100%;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    font-size: 0.9rem;
    border: 1px solid rgba(255,255,255,0.07);
  }

  .status.listening {
    border-color: rgba(0,245,255,0.3);
    background: rgba(0,245,255,0.05);
    color: #00f5ff;
  }

  .status.processing {
    border-color: rgba(255,78,205,0.3);
    background: rgba(255,78,205,0.05);
    color: #ff4ecd;
  }

  .status.idle {
    color: rgba(255,255,255,0.4);
  }

  .status-icon {
    font-size: 1.5rem;
  }

  .transcript {
    width: 100%;
    padding: 1.5rem;
    background: rgba(0,245,255,0.03);
    border: 1px solid rgba(0,245,255,0.2);
    border-radius: 8px;
  }

  .transcript-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 0.5rem;
  }

  .transcript-text {
    font-size: 0.95rem;
    color: white;
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }

  .confidence {
    font-size: 0.7rem;
    color: rgba(0,245,255,0.6);
  }

  .voice-button {
    width: 100%;
    padding: 1.5rem;
    background: #00f5ff;
    color: #070710;
    border: none;
    border-radius: 8px;
    font-family: 'Space Mono', monospace;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    transition: all 0.2s;
    box-shadow: 0 0 30px rgba(0,245,255,0.3);
  }

  .voice-button:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(0,245,255,0.5);
  }

  .voice-button.listening {
    background: #ff4ecd;
    box-shadow: 0 0 30px rgba(255,78,205,0.3);
  }

  .voice-button.listening:hover {
    box-shadow: 0 0 40px rgba(255,78,205,0.5);
  }

  .voice-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-icon {
    font-size: 1.2rem;
  }

  .instructions {
    width: 100%;
    padding: 1.5rem;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
  }

  .instructions strong {
    color: rgba(255,255,255,0.7);
    display: block;
    margin-bottom: 0.75rem;
  }

  .instructions ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .instructions li {
    padding-left: 1rem;
    position: relative;
  }

  .instructions li::before {
    content: '▸';
    position: absolute;
    left: 0;
    color: #00f5ff;
  }
</style>
