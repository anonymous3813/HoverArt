<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { SceneManager } from './SceneManager.ts';
	import { PoseDetector, drawPoseSkeleton } from '../boxing/PoseDetector.ts';

	let canvas: HTMLCanvasElement;
	let sceneManager: SceneManager;
	let animationId: number;

	// ─── UI State (Svelte 5 runes) ───────────────────────────────────────────
	let gameState = $state<'MENU' | 'CUTSCENE' | 'CAM_INIT' | 'FIGHTING' | 'VICTORY' | 'DEFEAT' | 'DRAW'>('MENU');
	let playerHP = $state(100);
	let cpuHP = $state(100);
	let roundTime = $state(180);
	let roundDisplay = $state('3:00');
	let combo = $state(0);
	let lastActionText = $state('');

	let camError = $state('');
	let poseStatus = $state('');
	let lastGesture = $state('');

	let videoEl = $state<HTMLVideoElement>();
	let overlayCanvas = $state<HTMLCanvasElement>();
	let detector: PoseDetector | null = null;
	let latestLandmarks: any[] | null = null;

	let actionTimeout: ReturnType<typeof setTimeout>;
	let gestureTimeout: ReturnType<typeof setTimeout>;

	function resize() {
		if (!sceneManager) return;
		const width = window.innerWidth;
		const height = window.innerHeight;
		sceneManager.renderer.setSize(width, height);
		sceneManager.camera.aspect = width / height;
		sceneManager.camera.updateProjectionMatrix();
	}

	function loop(time: number) {
		sceneManager.update(time * 0.001);
		sceneManager.render();
		animationId = requestAnimationFrame(loop);
	}

	onMount(() => {
		sceneManager = new SceneManager(canvas);

		// Connect game logic callbacks
		sceneManager.onPlayerHP = (hp) => (playerHP = hp);
		sceneManager.onCpuHP = (hp) => (cpuHP = hp);
		sceneManager.onTimer = (seconds) => {
			roundTime = seconds;
			const m = Math.floor(seconds / 60);
			const s = String(seconds % 60).padStart(2, '0');
			roundDisplay = `${m}:${s}`;
		};
		sceneManager.onCombo = (count) => (combo = count);
		sceneManager.onAction = (text) => {
			lastActionText = text;
			clearTimeout(actionTimeout);
			actionTimeout = setTimeout(() => (lastActionText = ''), 1200);
		};
		sceneManager.onStateChange = (state) => {
			gameState = state as any;
			if (state === 'VICTORY' || state === 'DEFEAT' || state === 'DRAW') {
				teardownPose();
			}
		};

		resize();
		window.addEventListener('resize', resize);
		animationId = requestAnimationFrame(loop);

		// Overlay loop
		function drawLoop() {
			requestAnimationFrame(drawLoop);
			if (!overlayCanvas || !latestLandmarks) return;
			const ctx = overlayCanvas.getContext('2d');
			if (ctx) drawPoseSkeleton(ctx, latestLandmarks, overlayCanvas.width, overlayCanvas.height);
		}
		requestAnimationFrame(drawLoop);
	});

	onDestroy(() => {
		cancelAnimationFrame(animationId);
		window.removeEventListener('resize', resize);
		teardownPose();
		sceneManager = null as any;
	});

	async function setupPose() {
		gameState = 'CAM_INIT';
		camError = '';
		poseStatus = 'Loading pose model…';

		await tick();

		if (!videoEl) {
			camError = 'Video element not ready yet';
			gameState = 'MENU';
			return;
		}

		try {
			detector = new PoseDetector(videoEl, {
				onGesture(gesture: string) {
					sceneManager?.playerGesture(gesture);

					const labels: Record<string, string> = {
						punchLeft: '👊 Left Hook',
						punchRight: '👊 Right Hook',
						blockStart: '🛡 Blocking',
						blockEnd: ''
					};
					if (labels[gesture]) {
						lastGesture = labels[gesture];
						clearTimeout(gestureTimeout);
						gestureTimeout = setTimeout(() => (lastGesture = ''), 800);
					}
				},
				onLandmarks(lm: any[]) {
					latestLandmarks = lm;
					poseStatus = 'Detecting…';
				}
			});

			await detector.init();
			poseStatus = 'Starting camera…';
			await detector.start();

			// The cutscene starts when the scene manager is created.
			// However, in our flow, we want to start fighting ONLY after cutscene finishes.
			// For boxing2, cutscene ends and calls `startFight()` on its own.
			// Let's just update the state visually so we know we are ready.
			// If cutscene is still running, gameState remains 'CUTSCENE' after this temporarily.
		} catch (err: any) {
			camError = err?.message ?? 'Camera access denied';
			gameState = 'MENU';
		}
	}

	function teardownPose() {
		detector?.dispose();
		detector = null;
		latestLandmarks = null;
	}

	function restartGame() {
		sceneManager?.restartFight();
		setupPose();
	}
</script>

<div class="container relative h-full min-h-[600px] w-full overflow-hidden bg-[#0a0a0a] font-boxing select-none">
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>

	<!-- Main Menu -->
	{#if gameState === 'MENU' || gameState === 'CUTSCENE'}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
			<div class="flex flex-col items-center gap-5 p-10 text-center text-white">
				<span class="rounded-sm bg-amber-400 px-3.5 py-1 text-[0.7rem] font-black tracking-[0.2em] text-black uppercase">
					Round 1
				</span>
				<h1 class="m-0 text-[clamp(3rem,10vw,6rem)] leading-[0.9] font-black tracking-tight uppercase">
					Knockout<br /><span class="text-amber-400">3D II</span>
				</h1>
				<p class="m-0 text-[0.8rem] tracking-[0.3em] text-[#555] uppercase">
					Three.js × MediaPipe
				</p>
				<div class="flex max-w-xs flex-col gap-2.5 rounded-lg border border-white/10 bg-white/5 px-6 py-4 text-left text-sm text-[#aaa]">
					<p class="m-0 text-xs font-bold tracking-widest text-white uppercase">How to play</p>
					<div class="flex items-start gap-2.5">
						<span class="text-xl leading-none">👊</span>
						<span>Throw a punch — extend your arm quickly</span>
					</div>
					<div class="flex items-start gap-2.5">
						<span class="text-xl leading-none">🛡</span>
						<span>Block — raise both arms</span>
					</div>
				</div>
				{#if camError}
					<p class="m-0 rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-400">
						⚠ {camError}
					</p>
				{/if}
				<button
					onclick={setupPose}
					class="cursor-pointer rounded border-none bg-amber-400 px-12 py-3.5 font-boxing text-[1.4rem] font-black tracking-[0.15em] text-black uppercase shadow-[0_4px_15px_rgba(251,191,36,0.3)] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(251,191,36,0.5)] active:translate-y-0.5 active:shadow-[0_2px_10px_rgba(251,191,36,0.3)]"
				>
					Fight!
				</button>
			</div>
		</div>
	{/if}

	<!-- Cam Init -->
	{#if gameState === 'CAM_INIT'}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-black/85 backdrop-blur-sm">
			<div class="flex flex-col items-center gap-4 text-center text-white">
				<span class="animate-pulse text-5xl">📷</span>
				<p class="m-0 text-lg tracking-widest text-amber-400 uppercase">{poseStatus}</p>
			</div>
		</div>
	{/if}

	<!-- HUD -->
	{#if gameState === 'FIGHTING'}
		<div class="absolute top-4 right-4 left-4 z-10 flex items-start gap-3">
			<div class="flex flex-1 items-center gap-2">
				<span class="text-[0.7rem] font-bold tracking-[0.15em] whitespace-nowrap text-white uppercase">You</span>
				<div class="h-3.5 flex-1 overflow-hidden rounded-sm border border-white/20 bg-black/60">
					<div class="h-full rounded-sm bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300" style="width: {playerHP}%"></div>
				</div>
				<span class="min-w-[28px] text-[0.8rem] font-bold text-white tabular-nums">{playerHP}</span>
			</div>
			<div class="flex min-w-[90px] flex-col items-center gap-1">
				<span class="rounded-sm bg-amber-400 px-2.5 py-0.5 text-[0.6rem] font-black tracking-[0.15em] text-black uppercase">Rd 1</span>
				<div class="text-[2rem] leading-none font-black tracking-[0.05em] transition-colors duration-300 {roundTime <= 30 ? 'animate-pulse text-red-400' : 'text-white'}">
					{roundDisplay}
				</div>
			</div>
			<div class="flex flex-1 flex-row-reverse items-center gap-2">
				<span class="text-[0.7rem] font-bold tracking-[0.15em] whitespace-nowrap text-white uppercase">CPU</span>
				<div class="h-3.5 flex-1 overflow-hidden rounded-sm border border-white/20 bg-black/60">
					<div class="float-right h-full rounded-sm bg-gradient-to-l from-red-500 to-red-400 transition-all duration-300" style="width: {cpuHP}%"></div>
				</div>
				<span class="min-w-[28px] text-right text-[0.8rem] font-bold text-white tabular-nums">{cpuHP}</span>
			</div>
		</div>

		<div class="absolute bottom-4 left-4 z-10 aspect-[4/3] w-36 overflow-hidden rounded-lg border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.7)]">
			<video bind:this={videoEl} class="absolute inset-0 h-full w-full scale-x-[-1] object-cover" autoplay muted playsinline></video>
			<canvas bind:this={overlayCanvas} width="144" height="108" class="absolute inset-0 h-full w-full"></canvas>
			<div class="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[0.55rem] tracking-wider text-amber-400 uppercase">{poseStatus}</div>
		</div>

		{#if lastGesture}
			<div class="pointer-events-none absolute bottom-4 left-1/2 z-[15] -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-1.5 text-sm font-bold tracking-widest text-amber-300 uppercase">
				{lastGesture}
			</div>
		{/if}

		{#if combo >= 2}
			<div class="pointer-events-none absolute top-1/2 left-1/2 z-[15] text-[clamp(2rem,6vw,4rem)] font-black tracking-[0.1em] text-amber-400 [text-shadow:0_0_30px_rgba(255,153,0,0.8)]">
				{combo}× Combo!
			</div>
		{/if}

		{#if lastActionText}
			<div class="pointer-events-none absolute bottom-20 left-1/2 z-[15] text-lg tracking-[0.2em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
				{lastActionText}
			</div>
		{/if}
	{/if}

	<!-- End Screen -->
	{#if gameState === 'VICTORY' || gameState === 'DEFEAT' || gameState === 'DRAW'}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-md">
			<div class="flex flex-col items-center gap-3.5 text-center text-white">
				{#if gameState === 'VICTORY'}
					<span class="text-6xl">🏆</span>
					<h2 class="m-0 text-[clamp(2.5rem,8vw,5rem)] tracking-[0.05em] text-amber-400 uppercase">Knockout!</h2>
					<p class="m-0 text-sm tracking-[0.15em] text-[#888]">You win this round</p>
				{:else if gameState === 'DEFEAT'}
					<span class="text-6xl">💀</span>
					<h2 class="m-0 text-[clamp(2.5rem,8vw,5rem)] tracking-[0.05em] text-red-500 uppercase">Down for the Count</h2>
					<p class="m-0 text-sm tracking-[0.15em] text-[#888]">Better luck next time</p>
				{:else}
					<span class="text-6xl">🤝</span>
					<h2 class="m-0 text-[clamp(2.5rem,8vw,5rem)] tracking-[0.05em] text-gray-400 uppercase">Split Decision</h2>
					<p class="m-0 text-sm tracking-[0.15em] text-[#888]">The judges call it a draw</p>
				{/if}

				<div class="flex gap-8 rounded-lg border border-white/10 bg-white/5 px-7 py-3">
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-[0.65rem] tracking-[0.15em] text-gray-600 uppercase">You</span>
						<strong class="text-xl font-black">{playerHP} HP</strong>
					</div>
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-[0.65rem] tracking-[0.15em] text-gray-600 uppercase">CPU</span>
						<strong class="text-xl font-black">{cpuHP} HP</strong>
					</div>
				</div>

				<button
					onclick={restartGame}
					class="cursor-pointer rounded border-none bg-amber-400 px-12 py-3.5 font-boxing text-[1.4rem] font-black tracking-[0.15em] text-black uppercase shadow-[0_4px_15px_rgba(251,191,36,0.3)] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(251,191,36,0.5)] active:translate-y-0.5 active:shadow-[0_2px_10px_rgba(251,191,36,0.3)]"
				>
					Play Again
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		width: 100vw;
		height: 100vh;
	}
</style>
