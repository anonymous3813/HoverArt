<script lang="ts">
	import { onDestroy } from 'svelte';
	import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
	import { mouthOpenFromBlendshapes } from '../flappy/mouthOpenFromFace.js';
	import {
		createInitialState,
		startGame,
		jump,
		updateGame,
		BIRD_X,
		BIRD_R,
		PIPE_W,
		PIPE_GAP,
		scaleFor,
		type FlappyState
	} from '../flappy/gameEngine.js';

	function computeCanvasSize(): { w: number; h: number } {
		if (typeof window === 'undefined') return { w: 800, h: 600 };
		return { w: window.innerWidth, h: window.innerHeight };
	}

	const INIT_H = 600;
	let canvasW = $state(800);
	let canvasH = $state(INIT_H);

	const MOUTH_THRESHOLD = 0.24;
	const DEBOUNCE_MS = 120;
	const RESET_MOUTH = 0.12;

	let videoEl: HTMLVideoElement;
	let canvasEl: HTMLCanvasElement;
	let faceLandmarker = $state<FaceLandmarker | null>(null);
	let stream: MediaStream | null = null;

	let loading = $state(true);
	let error = $state<string | null>(null);

	let gameState: FlappyState = createInitialState(INIT_H);
	let lastJumpAt = 0;
	let mouthArmed = true;

	let raf = 0;
	let lastFrame = 0;
	let lastDetectTs = -1;
	let lastMouthOpen = 0;

	function draw(ctx: CanvasRenderingContext2D, game: FlappyState, mouth: number) {
		const s = scaleFor(canvasW);
		const bx = BIRD_X * s;
		const br = BIRD_R * s;
		const pw = PIPE_W * s;
		const gh = (PIPE_GAP * s) / 2;

		ctx.fillStyle = '#07070d';
		ctx.fillRect(0, 0, canvasW, canvasH);

		ctx.setLineDash([10 * s, 14 * s]);
		ctx.strokeStyle = '#ffffff22';
		ctx.lineWidth = Math.max(1, 2 * s);
		for (const p of game.pipes) {
			const topH = p.gapCenterY - gh;
			const botY = p.gapCenterY + gh;
			ctx.fillStyle = '#0d0d14';
			ctx.strokeStyle = '#00f5ff55';
			ctx.lineWidth = Math.max(1, 2 * s);
			ctx.beginPath();
			ctx.rect(p.x, 0, pw, topH);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.rect(p.x, botY, pw, canvasH - botY);
			ctx.fill();
			ctx.stroke();
		}
		ctx.setLineDash([]);

		ctx.fillStyle = game.gameOver ? '#ff4444' : '#00f5ff';
		ctx.beginPath();
		ctx.arc(bx, game.birdY, br, 0, Math.PI * 2);
		ctx.fill();

		const hudH = Math.round(28 * s);
		ctx.fillStyle = 'rgba(0,0,0,0.35)';
		ctx.fillRect(0, 0, canvasW, hudH);
		ctx.fillStyle = '#ffffff88';
		ctx.font = `${Math.max(11, Math.round(12 * s))}px monospace`;
		ctx.fillText(`score ${game.score}  mouth ${(mouth * 100).toFixed(0)}%`, 10 * s, 18 * s);

		if (game.gameOver) {
			ctx.fillStyle = 'rgba(0,0,0,0.55)';
			ctx.fillRect(0, 0, canvasW, canvasH);
			ctx.fillStyle = '#fff';
			ctx.font = `bold ${Math.max(14, Math.round(16 * s))}px monospace`;
			ctx.textAlign = 'center';
			ctx.fillText('game over', canvasW / 2, canvasH / 2 - 12 * s);
			ctx.font = `${Math.max(11, Math.round(12 * s))}px monospace`;
			ctx.fillText(`score ${game.score} — click restart`, canvasW / 2, canvasH / 2 + 12 * s);
			ctx.textAlign = 'left';
		}
	}

	function loop(now: number) {
		raf = requestAnimationFrame(loop);
		const ctx = canvasEl?.getContext('2d');
		if (!ctx || !faceLandmarker || !videoEl) return;

		const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
		lastFrame = now;

		let mouth = 0;
		if (videoEl.readyState >= 2) {
			if (now !== lastDetectTs) {
				lastDetectTs = now;
				const res = faceLandmarker.detectForVideo(videoEl, now);
				lastMouthOpen =
					res.faceBlendshapes?.length > 0
						? mouthOpenFromBlendshapes(res.faceBlendshapes[0].categories)
						: 0;
			}
			mouth = lastMouthOpen;
		}

		if (mouth < RESET_MOUTH) mouthArmed = true;
		if (
			mouth >= MOUTH_THRESHOLD &&
			mouthArmed &&
			now - lastJumpAt >= DEBOUNCE_MS &&
			!gameState.gameOver
		) {
			jump(gameState, canvasW);
			lastJumpAt = now;
			mouthArmed = false;
		}

		updateGame(gameState, dt, canvasW, canvasH);

		draw(ctx, gameState, mouth);
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
				outputFaceBlendshapes: true,
				minFaceDetectionConfidence: 0.35,
				minFacePresenceConfidence: 0.35,
				minTrackingConfidence: 0.4
			});

			gameState = createInitialState(canvasH);
			canvasEl.width = canvasW;
			canvasEl.height = canvasH;
			lastFrame = 0;
			lastDetectTs = -1;
			lastMouthOpen = 0;
			raf = requestAnimationFrame(loop);
		} catch (e: any) {
			error = e?.message ?? 'Camera failed.';
		} finally {
			loading = false;
		}
	}

	function restart() {
		startGame(gameState, canvasH);
		lastJumpAt = 0;
		mouthArmed = true;
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
		Open your mouth briefly to jump. Drop below {(RESET_MOUTH * 100).toFixed(0)}% before the next jump
		({DEBOUNCE_MS}ms debounce). Dashed pipes scroll left.
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
