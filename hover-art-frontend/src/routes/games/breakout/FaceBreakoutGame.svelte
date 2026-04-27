<script lang="ts">
	import { onDestroy } from 'svelte';
	import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
	import { faceHorizontalFromLandmarks, paddle01HighSensitivity } from './faceHorizontal.js';
	import {
		createInitialState,
		startGame,
		updateGame,
		drawBreakout,
		type BreakoutState
	} from './gameEngine.js';

	function computeCanvasSize(): { w: number; h: number } {
		if (typeof window === 'undefined') return { w: 800, h: 600 };
		return { w: window.innerWidth, h: window.innerHeight };
	}

	const INIT_W = 800;
	const INIT_H = 600;

	let canvasW = $state(INIT_W);
	let canvasH = $state(INIT_H);

	let videoEl: HTMLVideoElement;
	let canvasEl: HTMLCanvasElement;
	let faceLandmarker = $state<FaceLandmarker | null>(null);
	let stream: MediaStream | null = null;

	let loading = $state(true);
	let error = $state<string | null>(null);

	let gameState: BreakoutState = createInitialState(INIT_W, INIT_H);
	let smoothedPaddle01 = 0.5;
	let lastFaceSeen = false;

	let raf = 0;
	let lastFrame = 0;
	let lastDetectTs = -1;

	function loop(now: number) {
		raf = requestAnimationFrame(loop);
		const ctx = canvasEl?.getContext('2d');
		if (!ctx || !faceLandmarker || !videoEl) return;

		const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
		lastFrame = now;

		let facePaddle: number | null = null;
		if (videoEl.readyState >= 2) {
			if (now !== lastDetectTs) {
				lastDetectTs = now;
				const res = faceLandmarker.detectForVideo(videoEl, now);
				const lm = res.faceLandmarks?.[0];
				const raw = faceHorizontalFromLandmarks(lm);
				if (raw != null) {
					lastFaceSeen = true;
					const target = paddle01HighSensitivity(raw);
					smoothedPaddle01 += (target - smoothedPaddle01) * 0.28;
				} else {
					lastFaceSeen = false;
				}
			}
			facePaddle = lastFaceSeen ? smoothedPaddle01 : null;
		}

		updateGame(gameState, dt, canvasW, canvasH, facePaddle);

		drawBreakout(ctx, gameState, canvasW, canvasH, facePaddle);
	}

	async function init() {
		error = null;
		loading = true;
		try {
			const size = computeCanvasSize();
			canvasW = size.w;
			canvasH = size.h;

			stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 1280, height: 720, facingMode: 'user' },
				audio: false
			});
			videoEl.srcObject = stream;
			await new Promise<void>((r) => (videoEl.onloadedmetadata = () => r()));
			await videoEl.play();

			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
			);
			faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
					delegate: 'GPU'
				},
				runningMode: 'VIDEO',
				numFaces: 1,
				outputFaceBlendshapes: false,
				minFaceDetectionConfidence: 0.35,
				minFacePresenceConfidence: 0.35,
				minTrackingConfidence: 0.4
			});

			gameState = createInitialState(canvasW, canvasH);
			smoothedPaddle01 = 0.5;
			lastFaceSeen = false;
			canvasEl.width = canvasW;
			canvasEl.height = canvasH;
			lastFrame = 0;
			lastDetectTs = -1;
			raf = requestAnimationFrame(loop);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Camera failed.';
		} finally {
			loading = false;
		}
	}

	function restart() {
		startGame(gameState, canvasW, canvasH);
		smoothedPaddle01 = 0.5;
	}

	function teardown() {
		cancelAnimationFrame(raf);
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		if (videoEl) videoEl.srcObject = null;
		faceLandmarker?.close();
		faceLandmarker = null;
	}

	onDestroy(() => {
		teardown();
	});
</script>

<div
	class="fixed inset-0 z-0 overflow-hidden bg-[#07070d] text-white"
	style="font-family: 'Space Mono', monospace;"
>
	<canvas bind:this={canvasEl} class="absolute inset-0 block h-full w-full touch-none"></canvas>

	<p
		class="pointer-events-none fixed top-10 left-1/2 z-20 max-w-lg -translate-x-1/2 px-4 text-center text-[10px] text-white/45 md:top-14 md:text-xs"
	>
		Move your head <span class="text-white/75">left and right</span> for the paddle (small turns reach the
		edges). Ball launches
		automatically. Red <span class="text-red-300/90">!</span> blocks explode neighbors. Each hit speeds up
		the ball.
	</p>

	{#if error}
		<p class="fixed top-24 left-1/2 z-40 max-w-sm -translate-x-1/2 px-4 text-center text-sm text-red-400">
			{error}
		</p>
	{/if}

	{#if loading}
		<p class="fixed top-24 left-1/2 z-40 -translate-x-1/2 text-xs text-white/50">Loading face model…</p>
	{/if}

	<video
		bind:this={videoEl}
		class="fixed right-3 bottom-20 z-30 h-24 w-32 -scale-x-100 rounded-md border border-white/15 object-cover opacity-90 md:right-4 md:bottom-24 md:h-32 md:w-44"
		muted
		playsinline
	></video>

	<div
		class="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-2"
	>
		{#if !faceLandmarker}
			<button
				type="button"
				class="rounded-lg border border-[#00f5ff]/40 bg-[#00f5ff]/15 px-5 py-2.5 text-sm text-[#00f5ff] backdrop-blur-sm"
				onclick={init}
			>
				Start webcam
			</button>
		{:else}
			<button
				type="button"
				class="rounded-lg border border-white/25 bg-black/30 px-5 py-2.5 text-sm text-white/85 backdrop-blur-sm"
				onclick={restart}
			>
				Restart
			</button>
			<button
				type="button"
				class="rounded-lg border border-red-400/35 bg-black/30 px-5 py-2.5 text-sm text-red-300 backdrop-blur-sm"
				onclick={teardown}
			>
				Stop camera
			</button>
		{/if}
	</div>
</div>
