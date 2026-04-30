<script lang="ts">import { onDestroy } from 'svelte';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { sampleFaceFromBlendshapes, type FaceSample } from './faceSignals.js';
import { createVoiceAnalyzer, type VoiceSnapshot } from './voiceSignals.js';
import { phase1FaceLieSignal, phase2VoiceLieSignal } from './phraseScores.js';
import { getBackendUrl } from '$lib/backendUrl';
const BACKEND_URL = getBackendUrl();
const RECORD_MAX_SEC = 14;
type Phase = 'idle' | 'session' | 'ready_phrase' | 'recording' | 'review' | 'analyzing' | 'result';
type Clip = {
    faceSamples: FaceSample[];
    voiceSamples: VoiceSnapshot[];
};
let phase = $state<Phase>('idle');
let error = $state<string | null>(null);
let loading = $state(false);
let videoEl: HTMLVideoElement;
let stream: MediaStream | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let voice: ReturnType<typeof createVoiceAnalyzer> | null = null;
let phraseIndex = $state(0);
let clips = $state<Clip[]>([{ faceSamples: [], voiceSamples: [] }, { faceSamples: [], voiceSamples: [] }, { faceSamples: [], voiceSamples: [] }]);
let transcripts = $state(['', '', '']);
let recordRemaining = $state(0);
let animId = 0;
let recordStart = 0;
let lastTs = -1;
let speechRec: SpeechRecognition | null = null;
let speechSupported = $state(false);
let apiResult = $state<Record<string, unknown> | null>(null);
let apiError = $state<string | null>(null);
if (typeof window !== 'undefined') {
    speechSupported = !!(window.SpeechRecognition || (window as unknown as {
        webkitSpeechRecognition?: unknown;
    }).webkitSpeechRecognition);
}
function stopSpeech() {
    try {
        speechRec?.stop();
    }
    catch {
    }
    speechRec = null;
}
function startSpeechForPhrase(idx: number) {
    stopSpeech();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR)
        return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: SpeechRecognitionEvent) => {
        let t = '';
        for (let i = 0; i < event.results.length; i++) {
            t += event.results[i][0].transcript;
        }
        transcripts = transcripts.map((prev, j) => (j === idx ? t.trim() : prev));
    };
    rec.onerror = () => { };
    try {
        rec.start();
        speechRec = rec;
    }
    catch {
    }
}
async function startSession() {
    error = null;
    loading = true;
    stopSession();
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: 'user' },
            audio: { echoCancellation: true, noiseSuppression: true }
        });
        videoEl.srcObject = stream;
        await new Promise<void>((r) => (videoEl.onloadedmetadata = () => r()));
        await videoEl.play();
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            minFaceDetectionConfidence: 0.35,
            minFacePresenceConfidence: 0.35,
            minTrackingConfidence: 0.4
        });
        voice = createVoiceAnalyzer(stream);
        await voice.ctx.resume();
        clips = [
            { faceSamples: [], voiceSamples: [] },
            { faceSamples: [], voiceSamples: [] },
            { faceSamples: [], voiceSamples: [] }
        ];
        transcripts = ['', '', ''];
        phraseIndex = 0;
        apiResult = null;
        phase = 'session';
    }
    catch (e: unknown) {
        error = e instanceof Error ? e.message : 'Camera or microphone permission failed.';
        phase = 'idle';
    }
    finally {
        loading = false;
    }
}
function stopSession() {
    cancelAnimationFrame(animId);
    stopSpeech();
    if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
    }
    if (videoEl)
        videoEl.srcObject = null;
    faceLandmarker?.close();
    faceLandmarker = null;
    voice?.close();
    voice = null;
    phase = 'idle';
    apiResult = null;
}
function beginRound() {
    phraseIndex = 0;
    clips = [
        { faceSamples: [], voiceSamples: [] },
        { faceSamples: [], voiceSamples: [] },
        { faceSamples: [], voiceSamples: [] }
    ];
    transcripts = ['', '', ''];
    apiResult = null;
    apiError = null;
    phase = 'ready_phrase';
}
function startPhraseRecord() {
    if (!faceLandmarker || !voice)
        return;
    clips = clips.map((c, i) => i === phraseIndex ? { faceSamples: [], voiceSamples: [] } : c);
    recordStart = performance.now();
    lastTs = -1;
    recordRemaining = RECORD_MAX_SEC;
    phase = 'recording';
    startSpeechForPhrase(phraseIndex);
    loopRecord();
}
function loopRecord() {
    animId = requestAnimationFrame(loopRecord);
    const now = performance.now();
    if (!faceLandmarker || !voice || phase !== 'recording')
        return;
    const elapsed = (now - recordStart) / 1000;
    recordRemaining = Math.max(0, RECORD_MAX_SEC - elapsed);
    if (elapsed >= RECORD_MAX_SEC) {
        cancelAnimationFrame(animId);
        finishPhraseClip();
        return;
    }
    if (now !== lastTs) {
        lastTs = now;
        const result = faceLandmarker.detectForVideo(videoEl, now);
        const clip = clips[phraseIndex];
        if (result.faceBlendshapes?.length) {
            const s = sampleFaceFromBlendshapes(result.faceBlendshapes[0].categories, now);
            if (s)
                clip.faceSamples.push(s);
        }
        clip.voiceSamples.push(voice.getSnapshot(now));
    }
}
function finishPhraseClip() {
    stopSpeech();
    if (phraseIndex < 2) {
        phraseIndex += 1;
        phase = 'ready_phrase';
    }
    else {
        phraseIndex = 2;
        phase = 'review';
    }
}
function finishPhraseEarly() {
    cancelAnimationFrame(animId);
    finishPhraseClip();
}
async function runAnalyze() {
    apiError = null;
    apiResult = null;
    for (let i = 0; i < 3; i++) {
        if (!transcripts[i].trim()) {
            apiError = `Phrase ${i + 1} needs text. Type what you said or re-record with speech recognition.`;
            return;
        }
    }
    loading = true;
    phase = 'analyzing';
    try {
        const phrases = clips.map((clip, i) => {
            const p1 = phase1FaceLieSignal(clip.faceSamples);
            const p2 = phase2VoiceLieSignal(clip.voiceSamples);
            return {
                index: i,
                transcript: transcripts[i].trim(),
                phase1FaceScore: p1.score,
                phase1FaceDetail: p1.detail,
                phase2VoiceScore: p2.score,
                phase2VoiceDetail: p2.detail
            };
        });
        const res = await fetch(`${BACKEND_URL}/games/two-truths-analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phrases })
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Analysis failed');
        apiResult = data.result as Record<string, unknown>;
        phase = 'result';
    }
    catch (e: unknown) {
        apiError = e instanceof Error ? e.message : 'Request failed';
        phase = 'review';
    }
    finally {
        loading = false;
    }
}
onDestroy(() => {
    cancelAnimationFrame(animId);
    stopSpeech();
    stopSession();
});
</script>

<div
	class="mx-auto flex w-full max-w-none flex-col items-center gap-5 rounded-xl border border-white/10 bg-[#111118] p-4 text-center text-white md:p-6"
	style="font-family: 'Space Mono', monospace;"
>
	<div
		class="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200/90"
	>
		<strong class="text-amber-100">Party game only.</strong>
		Three steps are experimental: (1) face motion heuristics while you speak, (2) microphone level /
		pauses / jitter heuristics, (3) OpenAI text analysis for plausibility — not a lie detector and not
		ground truth.
	</div>

	{#if error}
		<p class="w-full text-sm text-red-400">{error}</p>
	{/if}
	{#if apiError}
		<p class="w-full text-sm text-red-400">{apiError}</p>
	{/if}

	<div class="relative aspect-video w-full overflow-hidden rounded-lg bg-black/50">
		<video bind:this={videoEl} class="h-full w-full -scale-x-100 object-cover" muted playsinline
		></video>
		{#if phase === 'idle'}
			<div class="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/50">
				Preview after starting session
			</div>
		{/if}
	</div>

	<div class="flex w-full flex-wrap items-center justify-center gap-2">
		{#if phase === 'idle'}
			<button
				type="button"
				class="rounded-lg border border-[#00f5ff]/40 bg-[#00f5ff]/10 px-4 py-2 text-xs text-[#00f5ff] disabled:opacity-40"
				disabled={loading}
				onclick={startSession}
			>
				{loading ? 'Starting…' : 'Start camera + mic'}
			</button>
		{:else}
			<button
				type="button"
				class="rounded-lg border border-white/20 px-4 py-2 text-xs text-white/70"
				onclick={stopSession}
			>
				Stop session
			</button>

			{#if phase === 'session'}
				<button
					type="button"
					class="rounded-lg border border-violet-400/40 bg-violet-400/10 px-4 py-2 text-xs text-violet-200"
					onclick={beginRound}
				>
					Start game (3 phrases)
				</button>
			{/if}

			{#if phase === 'ready_phrase'}
				<button
					type="button"
					class="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200"
					onclick={startPhraseRecord}
				>
					Record phrase {phraseIndex + 1} / 3
				</button>
			{/if}

			{#if phase === 'recording'}
				<span class="self-center text-xs text-orange-300">Recording… {recordRemaining.toFixed(1)}s</span>
				<button
					type="button"
					class="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80"
					onclick={finishPhraseEarly}
				>
					Done speaking
				</button>
			{/if}
		{/if}
	</div>

	{#if phase === 'ready_phrase'}
		<div class="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80">
			<p class="m-0 font-bold text-white">Phrase {phraseIndex + 1} of 3</p>
			<p class="mt-2 mb-0">
				Say <strong>two truths and one lie</strong> across the three recordings (one statement per
				recording). For this clip, say one full sentence clearly.
			</p>
			{#if !speechSupported}
				<p class="mt-2 mb-0 text-xs text-amber-200/80">
					Speech recognition not available in this browser — you will type transcripts on the next
					step.
				</p>
			{/if}
		</div>
	{/if}

	{#if phase === 'review'}
		<div class="flex w-full flex-col items-stretch gap-4 text-left">
			<p class="m-0 text-center text-xs text-white/50">
				Edit transcripts if needed. Backend runs NLP (OpenAI) plus your face/voice summaries.
			</p>
			{#each [0, 1, 2] as i (i)}
				<label class="flex flex-col gap-1 text-xs text-white/40">
					Statement {i + 1}
					<textarea
						class="min-h-[72px] rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white"
						value={transcripts[i]}
						oninput={(e) => {
							const v = (e.currentTarget as HTMLTextAreaElement).value;
							transcripts = transcripts.map((t, j) => (j === i ? v : t));
						}}
					></textarea>
				</label>
			{/each}
			<button
				type="button"
				class="mx-auto w-fit rounded-lg border border-[#00f5ff]/40 bg-[#00f5ff]/10 px-4 py-2 text-xs text-[#00f5ff] disabled:opacity-40"
				disabled={loading}
				onclick={runAnalyze}
			>
				{loading ? 'Analyzing…' : 'Run 3-step analysis'}
			</button>
		</div>
	{/if}

	{#if phase === 'analyzing'}
		<p class="w-full text-sm text-white/50">Calling OpenAI for phrase analysis…</p>
	{/if}

	{#if phase === 'result' && apiResult}
		<div class="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left text-sm">
			<p class="m-0 text-xs uppercase tracking-widest text-white/40">Combined estimate</p>
			{#if typeof apiResult.estimatedLieCount === 'number'}
				<p class="mt-1 mb-0 text-2xl font-bold text-[#00f5ff]">
					~{apiResult.estimatedLieCount} / 3 flagged as likely lie(s)
				</p>
			{/if}
			{#if Array.isArray(apiResult.likelyLieIndices)}
				<p class="mt-2 mb-0 text-white/80">
					Likely lie index(es): {(apiResult.likelyLieIndices as number[]).map((n) => n + 1).join(', ')}
				</p>
			{/if}
			{#if typeof apiResult.confidence === 'string'}
				<p class="mt-1 mb-0 text-xs text-white/45">Model confidence: {apiResult.confidence}</p>
			{/if}
			{#if typeof apiResult.synthesis === 'string'}
				<p class="mt-3 mb-0 text-xs leading-relaxed text-white/65">{apiResult.synthesis}</p>
			{/if}
			{#if Array.isArray(apiResult.phase3PerPhrase)}
				<ul class="mt-3 list-inside list-disc space-y-1 text-xs text-white/55">
					{#each apiResult.phase3PerPhrase as row}
						<li>
							{#if typeof row === 'object' && row && 'index' in row}
								#{Number((row as { index: number }).index) + 1}:
								{(row as { nlpNote?: string }).nlpNote ?? ''}
								{#if typeof (row as { implausibilityScore?: number }).implausibilityScore === 'number'}
									(implausibility {(row as { implausibilityScore: number }).implausibilityScore}/100)
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if typeof apiResult.disclaimer === 'string'}
				<p class="mt-3 mb-0 text-[0.65rem] text-amber-200/70">{apiResult.disclaimer}</p>
			{/if}
			<button
				type="button"
				class="mt-4 w-full rounded-lg border border-violet-400/40 bg-violet-400/10 px-4 py-2 text-center text-xs text-violet-200 sm:w-auto"
				onclick={beginRound}
			>
				Play again
			</button>
		</div>
	{/if}
</div>
