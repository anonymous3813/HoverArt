export class VoiceManager {
    private synthesis: SpeechSynthesis;
    private voices: SpeechSynthesisVoice[] = [];
    private selectedVoice: SpeechSynthesisVoice | null = null;
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
    }
    private loadVoices() {
        this.voices = this.synthesis.getVoices();
        this.selectedVoice = this.voices.find(voice => voice.lang.includes('en') && voice.name.includes('Google')) || this.voices.find(voice => voice.lang.includes('en')) || this.voices[0] || null;
    }
    speak(text: string, options?: {
        rate?: number;
        pitch?: number;
        volume?: number;
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.synthesis) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }
            this.synthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            if (this.selectedVoice) {
                utterance.voice = this.selectedVoice;
            }
            utterance.rate = options?.rate || 1.1;
            utterance.pitch = options?.pitch || 1.0;
            utterance.volume = options?.volume || 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = (error) => reject(error);
            this.synthesis.speak(utterance);
        });
    }
    stop() {
        this.synthesis.cancel();
    }
    pause() {
        this.synthesis.pause();
    }
    resume() {
        this.synthesis.resume();
    }
    getVoices(): SpeechSynthesisVoice[] {
        return this.voices;
    }
    setVoice(voiceName: string) {
        const voice = this.voices.find(v => v.name === voiceName);
        if (voice) {
            this.selectedVoice = voice;
        }
    }
}
export class SpeechRecognitionManager {
    private recognition: any;
    private isListening: boolean = false;
    constructor() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Speech recognition not supported');
        }
        this.recognition = new SpeechRecognition();
        this.setupRecognition();
    }
    private setupRecognition() {
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 3;
    }
    start(callbacks: {
        onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
        onError?: (error: any) => void;
        onStart?: () => void;
        onEnd?: () => void;
    }): void {
        if (this.isListening)
            return;
        this.recognition.onstart = () => {
            this.isListening = true;
            callbacks.onStart?.();
        };
        this.recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';
            let maxConfidence = 0;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                if (result.isFinal) {
                    finalTranscript += transcript;
                    maxConfidence = Math.max(maxConfidence, result[0].confidence);
                    callbacks.onResult?.(transcript, true, result[0].confidence);
                }
                else {
                    interimTranscript += transcript;
                    callbacks.onResult?.(transcript, false, 0);
                }
            }
        };
        this.recognition.onerror = (event: any) => {
            this.isListening = false;
            callbacks.onError?.(event.error);
        };
        this.recognition.onend = () => {
            this.isListening = false;
            callbacks.onEnd?.();
        };
        this.recognition.start();
    }
    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    isActive(): boolean {
        return this.isListening;
    }
}
export class AudioVisualizer {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    async initialize(): Promise<void> {
        try {
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.analyser);
        }
        catch (error) {
            console.error('Audio visualizer initialization failed:', error);
            throw error;
        }
    }
    getFrequencyData(count: number = 32): number[] {
        if (!this.analyser || !this.dataArray) {
            return Array(count).fill(0);
        }
        this.analyser.getByteFrequencyData(this.dataArray);
        return Array.from(this.dataArray)
            .slice(0, count)
            .map(value => value / 255);
    }
    getVolumeLevel(): number {
        if (!this.analyser || !this.dataArray)
            return 0;
        this.analyser.getByteFrequencyData(this.dataArray);
        const sum = Array.from(this.dataArray).reduce((a, b) => a + b, 0);
        return sum / (this.dataArray.length * 255);
    }
    destroy() {
        if (this.source) {
            this.source.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
