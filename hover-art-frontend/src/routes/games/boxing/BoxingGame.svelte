<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { GameEngine } from './GameEngine';
	import { PoseDetector, drawPoseSkeleton } from './PoseDetector';

	// ─── Props (Svelte 5 runes) ───────────────────────────────────────────────
	interface Props {
		playerModelPath?: string;
		cpuModelPath?: string;
		animationPaths?: Record<string, string>;
	}

	let {
		playerModelPath = '/models/X Bot.fbx',
		cpuModelPath = '/models/X Bot.fbx',
		animationPaths = {
			idle: '/models/anims/X Bot@Fighting Idle.fbx',
			punchLeft: '/models/anims/X Bot@PunchingLeft.fbx',
			punchRight: '/models/anims/X Bot@PunchingRight.fbx',
			block: '/models/anims/X Bot@Body Block.fbx',
			hitReact: '/models/anims/X Bot@Hit To Body.fbx',
			victory: '/models/anims/X Bot@House Dancing.fbx',
			defeated: '/models/anims/X Bot@Knocked Out.fbx'
		}
	}: Props = $props();

	type GameState = 'MENU' | 'CAM_INIT' | 'FIGHTING' | 'VICTORY' | 'DEFEAT' | 'DRAW';

	let loadingProgress = $state(0);
	let loadingMessage = $state('Initialising…');
	let isLoaded = $state(false);
	let gameState = $state<GameState>('MENU');

	let playerHP = $state(100);
	let cpuHP = $state(100);
	let roundTime = $state(180);
	let roundDisplay = $state('3:00');
	let round = $state(1);
	let combo = $state(0);
	let lastActionText = $state('');

	let camError = $state(''); 
	let poseStatus = $state(''); // 'Detecting…' | 'Punch detected!' etc.
	let lastGesture = $state('');

	// ─── Element refs ─────────────────────────────────────────────────────────
	let gameCanvas: HTMLCanvasElement;
	let videoEl = $state<HTMLVideoElement>();
	let overlayCanvas = $state<HTMLCanvasElement>();

	// ─── Engine / detector ────────────────────────────────────────────────────
	let engine: GameEngine | null = null;
	let detector: PoseDetector | null = null;

	let actionTimeout: ReturnType<typeof setTimeout>;
	let gestureTimeout: ReturnType<typeof setTimeout>;

	// ─── Derived ──────────────────────────────────────────────────────────────
	// Skeleton overlay needs live landmark data; stored as a plain value updated
	// in the RAF loop — not reactive (no need to trigger renders for every frame).
	let latestLandmarks: any[] | null = null;

	// ─── Lifecycle ────────────────────────────────────────────────────────────
	onMount(async () => {
		engine = new GameEngine(gameCanvas, {
			playerModelPath,
			cpuModelPath,
			animationPaths,
			onProgress(pct: number, msg: string) {
				loadingProgress = pct;
				loadingMessage = msg;
			},
			onReady() {
				isLoaded = true;
			},
			onPlayerHP(hp: number) {
				playerHP = hp;
				if (hp <= 0) {
					gameState = 'DEFEAT';
					engine?.triggerDefeat();
					teardownPose();
				}
			},
			onCpuHP(hp: number) {
				cpuHP = hp;
				if (hp <= 0) {
					gameState = 'VICTORY';
					engine?.triggerVictory();
					teardownPose();
				}
			},
			onTimer(seconds: number) {
				roundTime = seconds;
				const m = Math.floor(seconds / 60);
				const s = String(seconds % 60).padStart(2, '0');
				roundDisplay = `${m}:${s}`;
				if (seconds <= 0) {
					gameState = playerHP > cpuHP ? 'VICTORY' : playerHP < cpuHP ? 'DEFEAT' : 'DRAW';
					if (gameState === 'VICTORY') engine?.triggerVictory();
					else if (gameState === 'DEFEAT') engine?.triggerDefeat();
					teardownPose();
				}
			},
			onCombo(count: number) {
				combo = count;
			},
			onAction(text: string) {
				lastActionText = text;
				clearTimeout(actionTimeout);
				actionTimeout = setTimeout(() => {
					lastActionText = '';
				}, 1200);
			}
		});

		await engine.init();

		// Skeleton overlay RAF loop — draws every frame without triggering Svelte renders
		function drawLoop() {
			requestAnimationFrame(drawLoop);
			if (!overlayCanvas || !latestLandmarks) return;
			const ctx = overlayCanvas.getContext('2d')!;
			drawPoseSkeleton(ctx, latestLandmarks, overlayCanvas.width, overlayCanvas.height);
		}
		requestAnimationFrame(drawLoop);

		return () => {
			teardownPose();
			engine?.dispose();
			clearTimeout(actionTimeout);
			clearTimeout(gestureTimeout);
		};
	});

	// ─── Pose setup / teardown ────────────────────────────────────────────────

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
					engine?.playerGesture(gesture);

					// Visual feedback badge
					const labels: Record<string, string> = {
						punchLeft: '👊 Left Hook',
						punchRight: '👊 Right Hook',
						blockStart: '🛡 Blocking',
						blockEnd: ''
					};
					if (labels[gesture]) {
						lastGesture = labels[gesture];
						clearTimeout(gestureTimeout);
						gestureTimeout = setTimeout(() => {
							lastGesture = '';
						}, 800);
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

			gameState = 'FIGHTING';
			engine?.startFight();
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
		playerHP = 100;
		cpuHP = 100;
		roundTime = 180;
		roundDisplay = '3:00';
		combo = 0;
		engine?.restartFight();
		setupPose();
	}
</script>


<div
	class="relative h-full min-h-[600px] w-full overflow-hidden bg-[#0a0a0a] font-boxing select-none"
>
	<!-- THREE.js canvas -->
	<canvas bind:this={gameCanvas} class="block h-full w-full"></canvas>

	
	{#if !isLoaded}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]">
			<div class="flex flex-col items-center gap-4 text-center text-white">
				<span class="animate-scale-pulse text-6xl">🥊</span>
				<h2 class="m-0 text-3xl tracking-[0.25em] text-amber-400 uppercase">Loading Fight</h2>
				<div class="h-1.5 w-72 overflow-hidden rounded-full bg-[#222]">
					<div
						class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-600 transition-all duration-300"
						style="width: {loadingProgress}%"
					></div>	
				</div>
				<p class="m-0 text-sm tracking-[0.05em] text-[#888]">{loadingMessage}</p>
			</div>
		</div>
	{/if}

	
	{#if isLoaded && gameState === 'MENU'}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm"
		>
			<div class="flex flex-col items-center gap-5 p-10 text-center text-white">
				<span
					class="rounded-sm bg-amber-400 px-3.5 py-1 text-[0.7rem] font-black tracking-[0.2em] text-black uppercase"
				>
					Round 1
				</span>

				<h1
					class="m-0 text-[clamp(3rem,10vw,6rem)] leading-[0.9] font-black tracking-tight uppercase"
				>
					Knockout<br /><span class="text-amber-400">3D</span>
				</h1>

				<p class="m-0 text-[0.8rem] tracking-[0.3em] text-[#555] uppercase">
					Three.js × Mixamo × MediaPipe
				</p>

				
				<div
					class="flex max-w-xs flex-col gap-2.5 rounded-lg border border-white/10 bg-white/5 px-6 py-4 text-left text-sm text-[#aaa]"
				>
					<p class="m-0 text-xs font-bold tracking-widest text-white uppercase">How to play</p>
					<div class="flex items-start gap-2.5">
						<span class="text-xl leading-none">👊</span>
						<span>Throw a punch — extend your arm quickly toward the camera</span>
					</div>
					<div class="flex items-start gap-2.5">
						<span class="text-xl leading-none">🛡</span>
						<span>Block — raise both arms above your shoulders</span>
					</div>
					<div class="flex items-start gap-2.5">
						<span class="text-xl leading-none">📷</span>
						<span>Your webcam is used for pose detection — no data leaves your device</span>
					</div>
				</div>

				{#if camError}
					<p class="m-0 rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-400">
						⚠ {camError}
					</p>
				{/if}

				<button
					onclick={setupPose}
					class="cursor-pointer rounded border-none bg-amber-400 px-12 py-3.5
                 font-boxing text-[1.4rem] font-black tracking-[0.15em] text-black uppercase
                 shadow-fight transition-all duration-100
                 hover:-translate-y-0.5 hover:shadow-fight-hover
                 active:translate-y-0.5 active:shadow-fight-active"
				>
					Fight!
				</button>
			</div>
		</div>
	{/if}

	
	{#if gameState === 'CAM_INIT'}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-black/85 backdrop-blur-sm"
		>
			<div class="flex flex-col items-center gap-4 text-center text-white">
				<span class="animate-scale-pulse text-5xl">📷</span>
				<p class="m-0 text-lg tracking-widest text-amber-400 uppercase">{poseStatus}</p>
				<p class="m-0 text-sm text-[#666]">Allow camera access when prompted</p>
			</div>
		</div>
	{/if}

	
	{#if isLoaded && (gameState === 'FIGHTING' || gameState === 'CAM_INIT')}
		
		<div class="absolute top-4 right-4 left-4 z-10 flex items-start gap-3">
			
			<div class="flex flex-1 items-center gap-2">
				<span
					class="text-[0.7rem] font-bold tracking-[0.15em] whitespace-nowrap text-white uppercase"
					>You</span
				>
				<div class="h-3.5 flex-1 overflow-hidden rounded-sm border border-white/20 bg-black/60">
					<div
						class="h-full rounded-sm bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
						style="width: {playerHP}%"
					></div>
				</div>
				<span class="min-w-[28px] text-[0.8rem] font-bold text-white tabular-nums">{playerHP}</span>
			</div>

			
			<div class="flex min-w-[90px] flex-col items-center gap-1">
				<span
					class="rounded-sm bg-amber-400 px-2.5 py-0.5 text-[0.6rem] font-black tracking-[0.15em] text-black uppercase"
				>
					Rd {round}
				</span>
				<div
					class="text-[2rem] leading-none font-black tracking-[0.05em] transition-colors duration-300
                    {roundTime <= 30 ? 'animate-blink text-red-400' : 'text-white'}"
				>
					{roundDisplay}
				</div>
			</div>

			
			<div class="flex flex-1 flex-row-reverse items-center gap-2">
				<span
					class="text-[0.7rem] font-bold tracking-[0.15em] whitespace-nowrap text-white uppercase"
					>CPU</span
				>
				<div class="h-3.5 flex-1 overflow-hidden rounded-sm border border-white/20 bg-black/60">
					<div
						class="float-right h-full rounded-sm bg-gradient-to-l from-red-500 to-red-400 transition-all duration-300"
						style="width: {cpuHP}%"
					></div>
				</div>
				<span class="min-w-[28px] text-right text-[0.8rem] font-bold text-white tabular-nums"
					>{cpuHP}</span
				>
			</div>
		</div>

		<!-- Webcam + skeleton overlay -->
		<div
			class="absolute bottom-4 left-4 z-10 aspect-[4/3] w-36 overflow-hidden rounded-lg
                border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
		>
			
			<video
				bind:this={videoEl}
				class="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
				autoplay
				muted
				playsinline
			></video>
			<!-- Skeleton overlay canvas -->
			<canvas
				bind:this={overlayCanvas}
				width="144"
				height="108"
				class="absolute inset-0 h-full w-full"
			></canvas>
			<!-- Status badge -->
			<div
				class="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center
                  text-[0.55rem] tracking-wider text-amber-400 uppercase"
			>
				{poseStatus}
			</div>
		</div>

		<!-- Gesture feedback badge -->
		{#if lastGesture}
			{#key lastGesture}
				<div
					class="pointer-events-none absolute bottom-4 left-1/2 z-[15]
                    -translate-x-1/2
                    animate-fade-up rounded-full border border-amber-400/40
                    bg-amber-400/10 px-5 py-1.5 text-sm font-bold
                    tracking-widest text-amber-300
                    uppercase"
				>
					{lastGesture}
				</div>
			{/key}
		{/if}

		<!-- Combo flash -->
		{#if combo >= 2}
			{#key combo}
				<div
					class="pointer-events-none absolute top-1/2 left-1/2 z-[15]
                    animate-pop-in text-[clamp(2rem,6vw,4rem)] font-black
                    tracking-[0.1em]
                    text-amber-400
                    [text-shadow:0_0_30px_rgba(255,153,0,0.8)]"
				>
					{combo}× Combo!
				</div>
			{/key}
		{/if}

		
		{#if lastActionText}
			{#key lastActionText}
				<div
					class="pointer-events-none absolute bottom-20 left-1/2 z-[15]
                    animate-fade-up text-lg tracking-[0.2em]
                    text-white
                    [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]"
				>
					{lastActionText}
				</div>
			{/key}
		{/if}
	{/if}

	
	{#if isLoaded && (gameState === 'VICTORY' || gameState === 'DEFEAT' || gameState === 'DRAW')}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-md"
		>
			<div class="flex flex-col items-center gap-3.5 text-center text-white">
				{#if gameState === 'VICTORY'}
					<span class="text-6xl">🏆</span>
					<h2 class="m-0 text-[clamp(2.5rem,8vw,5rem)] tracking-[0.05em] text-amber-400 uppercase">
						Knockout!
					</h2>
					<p class="m-0 text-sm tracking-[0.15em] text-[#888]">You win this round</p>
				{:else if gameState === 'DEFEAT'}
					<span class="text-6xl">💀</span>
					<h2 class="m-0 text-[clamp(2.5rem,8vw,5rem)] tracking-[0.05em] text-red-500 uppercase">
						Down for the Count
					</h2>
					<p class="m-0 text-sm tracking-[0.15em] text-[#888]">Better luck next time</p>
				{:else}
					<span class="text-6xl">🤝</span>
					<h2 class="m-0 text-[clamp(2.5rem,8vw,5rem)] tracking-[0.05em] text-gray-400 uppercase">
						Split Decision
					</h2>
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
					class="cursor-pointer rounded border-none bg-amber-400 px-12 py-3.5
                 font-boxing text-[1.4rem] font-black tracking-[0.15em] text-black uppercase
                 shadow-fight transition-all duration-100
                 hover:-translate-y-0.5 hover:shadow-fight-hover
                 active:translate-y-0.5 active:shadow-fight-active"
				>
					Rematch
				</button>
			</div>
		</div>
	{/if}
</div>
