<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
	import { gameSocket } from '$lib/services/gameSocket.ts';
	import {
		CORNER,
		TEAM_COLORS,
		TEAM_NAMES,
		cardDisplayName,
		isJack,
		type BoardCard,
		type DeckCard
	} from './boardConfig.ts';
	import {
		type SequenceGameState,
		type SequenceAction,
		getCurrentPlayer,
		isPlayerTurn,
		getValidPlacements,
		getValidRemovals,
		isCardDead,
		createSequenceGame,
		applyAction,
		getPublicState
	} from './sequenceEngine.ts';
	import {
		AI_PLAYER_ID,
		HUMAN_PLAYER_ID,
		chooseAiAction,
		createSoloVsAiGame,
		isAiPlayer,
		type AiDifficulty
	} from './sequenceAI.ts';
	import {
		landmarksToCursor,
		cursorToScreen,
		findHitTarget,
		PinchDetector,
		collectRects,
		type HandCursor
	} from './handCursor.ts';
	import PlayingCard from './PlayingCard.svelte';

	interface Props {
		multiplayer?: boolean;
		vsAi?: boolean;
		aiDifficulty?: AiDifficulty;
		roomCode?: string;
		players?: { id: string; name: string; team?: number }[];
		playerId?: string;
		playerName?: string;
		initialState?: SequenceGameState | null;
	}

	let {
		multiplayer = false,
		vsAi = false,
		aiDifficulty = 'medium',
		roomCode = '',
		players = [],
		playerId = '',
		playerName = 'Player',
		initialState = null
	}: Props = $props();

	const dispatch = createEventDispatcher<{ gameOver: { winner: number }; back: void }>();

	let gameState = $state<SequenceGameState | null>(null);
	let publicState = $derived.by(() => {
		if (!gameState) return null;
		if (multiplayer && playerId)
			return getPublicState(gameState, playerId) as SequenceGameState & {
				myHand: DeckCard[];
				opponentHandCounts: Record<string, number>;
			};
		return {
			...gameState,
			myHand: gameState.hands[playerId || gameState.players[0]?.id] ?? [],
			opponentHandCounts: {}
		};
	});

	let handsReady = $state(false);
	let statusMsg = $state('Initialising camera…');
	let actionError = $state('');
	let aiThinking = $state(false);
	let aiTurnToken = 0;

	let cursor = $state<HandCursor>({ x: 0.5, y: 0.5, pinching: false, visible: false });
	let hoverId = $state('');

	let gameRoot: HTMLDivElement;
	let videoEl: HTMLVideoElement;
	let previewVideo: HTMLVideoElement;
	let handLandmarker: HandLandmarker | null = null;
	let mediaStream: MediaStream | null = null;
	let rafId: number | null = null;
	const pinchDetector = new PinchDetector();

	const humanId = $derived(
		vsAi ? HUMAN_PLAYER_ID : playerId || gameSocket.playerId || gameState?.players[0]?.id || ''
	);
	const myPlayerId = $derived(humanId);
	const isMyTurn = $derived(
		gameState
			? multiplayer
				? isPlayerTurn(gameState, myPlayerId)
				: vsAi
					? isPlayerTurn(gameState, HUMAN_PLAYER_ID)
					: gameState.winner === null
			: false
	);
	const currentPlayer = $derived(gameState ? getCurrentPlayer(gameState) : null);
	const myHand = $derived(
		gameState
			? multiplayer
				? (publicState?.myHand ?? publicState?.hands?.[myPlayerId] ?? [])
				: vsAi
					? (gameState.hands[HUMAN_PLAYER_ID] ?? [])
					: (gameState.hands[myPlayerId] ?? [])
			: []
	);
	const aiHandCount = $derived(vsAi && gameState ? (gameState.hands[AI_PLAYER_ID]?.length ?? 0) : 0);
	const humanTeam = $derived(gameState?.players.find((p) => p.id === HUMAN_PLAYER_ID)?.team ?? 0);
	const myTeam = $derived(
		gameState?.players.find((p) =>
			multiplayer ? p.id === myPlayerId : vsAi ? p.id === HUMAN_PLAYER_ID : p.id === myPlayerId
		)?.team ?? 0
	);

	const validCellKeys = $derived.by(() => {
		const keys = new Set<string>();
		if (!gameState || !isMyTurn) return keys;
		if (gameState.phase === 'place-chip' || gameState.phase === 'wild-place') {
			for (const [r, c] of getValidPlacements(gameState)) keys.add(`${r},${c}`);
		} else if (gameState.phase === 'remove-chip') {
			for (const [r, c] of getValidRemovals(gameState, myTeam)) keys.add(`${r},${c}`);
		}
		return keys;
	});

	function isValidCell(r: number, c: number): boolean {
		return validCellKeys.has(`${r},${c}`);
	}

	function initLocalGame() {
		if (vsAi) {
			gameState = initialState ?? createSoloVsAiGame(playerName);
			return;
		}
		const pls =
			players.length >= 2
				? players.map((p) => ({ id: p.id, name: p.name }))
				: [
						{ id: 'p1', name: playerName || 'You' },
						{ id: 'p2', name: 'Opponent' }
					];
		gameState = initialState ?? createSequenceGame(pls);
	}

	function delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function runAiTurn(token: number) {
		if (!vsAi || multiplayer) return;
		try {
			await delay(500);
			while (token === aiTurnToken) {
				const state = gameState;
				if (!state || state.winner !== null) break;
				if (!isAiPlayer(getCurrentPlayer(state).id)) break;

				const action = chooseAiAction(state, AI_PLAYER_ID, aiDifficulty);
				if (!action) {
					actionError = 'AI could not find a move';
					break;
				}
				const result = applyAction(state, AI_PLAYER_ID, action);
				if (!result.ok) {
					actionError = result.error ?? 'AI move failed';
					break;
				}
				gameState = structuredClone(state);
				await delay(450);
			}
			const final = gameState;
			if (final?.winner !== null && final?.winner !== undefined) {
				dispatch('gameOver', { winner: final.winner });
			}
		} catch (err) {
			console.error('AI turn error:', err);
			actionError = 'AI error — refresh and try again';
		} finally {
			if (token === aiTurnToken) aiThinking = false;
		}
	}

	function scheduleAiIfNeeded() {
		if (!vsAi || multiplayer || aiThinking || !gameState) return;
		const cur = getCurrentPlayer(gameState);
		if (!isAiPlayer(cur.id) || gameState.winner !== null) return;
		aiThinking = true;
		const token = ++aiTurnToken;
		runAiTurn(token);
	}

	function handlePinchSelect() {
		if (!gameRoot || !gameState || !isMyTurn || aiThinking) return;
		actionError = '';

		const w = window.innerWidth;
		const h = window.innerHeight;
		const targets = collectRects(gameRoot, '[data-hit-id]');
		const hit = findHitTarget(cursor, w, h, targets);
		if (!hit) return;

		const kind = hit.meta?.hitKind;
		if (kind === 'card' && gameState.phase === 'select-card') {
			const idx = Number(hit.meta?.cardIndex);
			const card = myHand[idx];
			if (card && !isJack(card) && isCardDead(gameState, card as BoardCard)) {
				sendAction({ type: 'declare-dead', cardIndex: idx });
			} else {
				sendAction({ type: 'play-card', cardIndex: idx });
			}
		} else if (kind === 'cell') {
			const row = Number(hit.meta?.row);
			const col = Number(hit.meta?.col);
			if (!isValidCell(row, col)) return;
			if (gameState.phase === 'remove-chip') {
				sendAction({ type: 'remove-chip', row, col });
			} else if (gameState.phase === 'place-chip' || gameState.phase === 'wild-place') {
				sendAction({ type: 'place-chip', row, col });
			}
		} else if (kind === 'dead-btn' && gameState.phase === 'select-card') {
			sendAction({ type: 'declare-dead', cardIndex: Number(hit.meta?.cardIndex) });
		}
	}

	function sendAction(action: SequenceAction) {
		if (multiplayer) {
			gameSocket.sendSequenceAction(action);
			return;
		}
		if (!gameState) return;
		const actorId = vsAi ? HUMAN_PLAYER_ID : myPlayerId;
		const result = applyAction(gameState, actorId, action);
		if (!result.ok) {
			actionError = result.error ?? 'Invalid move';
			return;
		}
		gameState = structuredClone(gameState);
		actionError = '';
		if (gameState.winner !== null && gameState.winner !== undefined) {
			dispatch('gameOver', { winner: gameState.winner });
			return;
		}
		scheduleAiIfNeeded();
	}

	function processHands(result: { landmarks?: { x: number; y: number; z?: number }[][] }) {
		if (result.landmarks?.length) {
			cursor = landmarksToCursor(result.landmarks[0]);
			if (isMyTurn && !aiThinking && pinchDetector.check(cursor)) {
				handlePinchSelect();
			}
			if (gameRoot) {
				const targets = collectRects(gameRoot, '[data-hit-id]');
				const hit = findHitTarget(cursor, window.innerWidth, window.innerHeight, targets);
				hoverId = hit?.id ?? '';
			}
		} else {
			cursor = { ...cursor, visible: false };
			hoverId = '';
		}
	}

	function loop(ts: number) {
		rafId = requestAnimationFrame(loop);
		if (videoEl?.readyState >= 2 && handLandmarker) {
			processHands(handLandmarker.detectForVideo(videoEl, ts));
		}
	}

	async function initCamera() {
		try {
			statusMsg = 'Loading hand model…';
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
			);
			handLandmarker = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
					delegate: 'GPU'
				},
				runningMode: 'VIDEO',
				numHands: 1,
				minHandDetectionConfidence: 0.5,
				minHandPresenceConfidence: 0.5,
				minTrackingConfidence: 0.5
			});

			mediaStream = await navigator.mediaDevices.getUserMedia({
				video: { width: 640, height: 480, facingMode: 'user' }
			});
			videoEl.srcObject = mediaStream;
			if (previewVideo) previewVideo.srcObject = mediaStream;
			await videoEl.play();
			handsReady = true;
			statusMsg = 'Point index finger to aim · Pinch to select';
			rafId = requestAnimationFrame(loop);
		} catch (e: unknown) {
			statusMsg = `Camera error: ${e instanceof Error ? e.message : e}`;
		}
	}

	function onSequenceState(payload: { state: SequenceGameState; error?: string }) {
		if (payload.error) actionError = payload.error;
		if (payload.state) {
			gameState = payload.state;
			if (gameState.winner !== null && gameState.winner !== undefined) {
				dispatch('gameOver', { winner: gameState.winner });
			}
		}
	}

	$effect(() => {
		if (vsAi && gameState && !multiplayer) {
			scheduleAiIfNeeded();
		}
	});

	onMount(() => {
		if (multiplayer && initialState) {
			gameState = initialState;
		} else if (!multiplayer) {
			initLocalGame();
		}
		initCamera();
		if (multiplayer) gameSocket.onSequenceState(onSequenceState);
	});

	onDestroy(() => {
		aiTurnToken++;
		if (rafId) cancelAnimationFrame(rafId);
		mediaStream?.getTracks().forEach((t) => t.stop());
		handLandmarker?.close();
		if (multiplayer) gameSocket.offSequenceHandlers(onSequenceState);
	});

	function chipColor(team: number | null): string {
		if (team === null) return 'transparent';
		return TEAM_COLORS[team] ?? '#888';
	}
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<video bind:this={videoEl} class="hidden-video" playsinline muted></video>

<div class="game-root" bind:this={gameRoot}>
	{#if cursor.visible}
		{@const pos = cursorToScreen(cursor, window.innerWidth, window.innerHeight)}
		<div
			class="hand-cursor"
			class:pinching={cursor.pinching}
			style="left:{pos.x}px;top:{pos.y}px"
		></div>
	{/if}

	<header class="hud">
		<div class="hud-left">
			<h1>Sequence</h1>
			{#if multiplayer && roomCode}<span class="room-tag">Room {roomCode}</span>{/if}
		</div>
		<div class="scores">
			{#each gameState?.teamScores ?? [] as score, i}
				<div class="score-pill" style="--team-color:{TEAM_COLORS[i]}">
					<span class="dot"></span>
					{TEAM_NAMES[i]}: {score}/{gameState?.sequencesNeeded ?? 2}
				</div>
			{/each}
		</div>
		<div class="hud-right">
			<span class="deck-count">Deck: {gameState?.deckCount ?? 0}</span>
			{#if vsAi}<span class="ai-cards">AI: {aiHandCount} cards</span>{/if}
		</div>
	</header>

	<div class="status-bar">
		<span>{gameState?.message ?? statusMsg}</span>
		{#if aiThinking}
			<span class="ai-thinking">AI playing…</span>
		{:else if isMyTurn}
			<span class="your-turn">YOUR TURN</span>
			<span class="gesture-hint">Index finger = aim · Pinch = select</span>
		{:else if currentPlayer}
			<span class="wait-turn">{currentPlayer.name}'s turn</span>
		{/if}
		{#if actionError}<span class="error">{actionError}</span>{/if}
	</div>

	<div class="main-layout">
		<div class="board-wrap">
			{#key `${gameState?.currentPlayerIndex}-${gameState?.phase}-${gameState?.playedCard ?? ''}`}
			<div class="board">
				{#each gameState?.board ?? [] as row, r}
					{#each row as chip, c}
						{@const card = gameState?.boardCards[r][c]}
						{@const locked = gameState?.locked[r][c]}
						{@const cellKey = `${r},${c}`}
						{@const highlight = validCellKeys.has(cellKey)}
						{@const hitId = `cell-${r}-${c}`}
						<div
							class="cell"
							class:corner={card === CORNER}
							class:placement-target={highlight}
							class:hovered={hoverId === hitId}
							class:locked
							data-hit-id={highlight ? hitId : undefined}
							data-hit-kind={highlight ? 'cell' : undefined}
							data-row={highlight ? r : undefined}
							data-col={highlight ? c : undefined}
						>
						<div class="cell-card">
							<PlayingCard {card} size="board" />
						</div>
						{#if highlight}
							<span class="placement-ring" aria-hidden="true"></span>
						{/if}
							{#if chip !== null}
								<span
									class="chip"
									style="background:{chipColor(chip)}"
									class:locked-chip={locked}
								></span>
							{/if}
						</div>
					{/each}
				{/each}
			</div>
			{/key}
		</div>

		<aside class="side-panel">
			<div class="camera-box">
				<video bind:this={previewVideo} class="camera-preview" playsinline muted autoplay></video>
				<span class="cam-label">{handsReady ? 'Hand cam' : statusMsg}</span>
			</div>

			<div class="gesture-guide">
				<p><strong>Aim</strong> — point with index finger</p>
				<p><strong>Select</strong> — pinch thumb + index on a card or board spot</p>
			</div>

			<div class="hand-strip">
				<p class="hand-label">Your hand ({myHand.length})</p>
				<div class="hand-cards">
					{#each myHand as card, i}
						{@const dead = gameState && !isJack(card) && isCardDead(gameState, card as BoardCard)}
						{@const hitId = `card-${i}`}
						<div
							class="hand-card-wrap"
							class:hovered={hoverId === hitId}
							class:dead
							data-hit-id={hitId}
							data-hit-kind="card"
							data-card-index={i}
							title={cardDisplayName(card)}
						>
							<PlayingCard {card} size="hand" />
							{#if dead && isMyTurn && gameState?.phase === 'select-card'}
								<span
									class="dead-badge"
									data-hit-id={`dead-${i}`}
									data-hit-kind="dead-btn"
									data-card-index={i}
								>DEAD</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</aside>
	</div>

	{#if gameState?.winner !== null && gameState?.winner !== undefined}
		<div class="win-overlay">
			<h2>
				{#if vsAi}
					{gameState.winner === humanTeam ? 'You Win!' : 'AI Wins!'}
				{:else}
					{TEAM_NAMES[gameState.winner]} Team Wins!
				{/if}
			</h2>
			<button onclick={() => dispatch('back')}>Back to Lobby</button>
		</div>
	{/if}
</div>

<style>
	.hidden-video {
		position: fixed;
		opacity: 0;
		pointer-events: none;
		width: 1px;
		height: 1px;
	}

	.game-root {
		height: 100vh;
		max-height: 100vh;
		overflow: hidden;
		background: #070710;
		color: #e0e0f0;
		font-family: 'Space Mono', monospace;
		padding: 0.5rem 0.75rem;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		position: relative;
	}

	.hand-cursor {
		position: fixed;
		width: 22px;
		height: 22px;
		border: 2px solid #00f5ff;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 9999;
		box-shadow: 0 0 12px rgba(0, 245, 255, 0.6);
		transition: transform 0.05s, background 0.1s;
	}

	.hand-cursor.pinching {
		background: rgba(0, 245, 255, 0.5);
		transform: translate(-50%, -50%) scale(0.7);
	}

	.hud {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
		flex-shrink: 0;
	}

	.hud h1 {
		font-family: 'Syne', sans-serif;
		font-size: 1.15rem;
		font-weight: 800;
		margin: 0;
		color: #fff;
	}

	.room-tag {
		font-size: 0.6rem;
		color: rgba(255, 255, 255, 0.4);
		margin-left: 0.4rem;
	}

	.scores {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.score-pill {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--team-color);
		border-radius: 20px;
		font-size: 0.62rem;
		color: var(--team-color);
	}

	.score-pill .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--team-color);
	}

	.hud-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.62rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.ai-cards {
		color: rgba(34, 197, 94, 0.85);
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.35rem 0.65rem;
		background: rgba(0, 245, 255, 0.05);
		border: 1px solid rgba(0, 245, 255, 0.2);
		border-radius: 6px;
		margin-bottom: 0.4rem;
		font-size: 0.65rem;
		flex-shrink: 0;
	}

	.your-turn {
		color: #34d399;
		font-weight: 700;
	}

	.ai-thinking {
		color: #ffdd57;
		font-weight: 700;
		animation: pulse 1s infinite;
	}

	.wait-turn {
		color: rgba(255, 255, 255, 0.45);
	}

	.gesture-hint {
		color: #00f5ff;
	}

	.error {
		color: #ff4e4e;
	}

	.main-layout {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr minmax(150px, 22vw);
		gap: 0.5rem;
	}

	.board-wrap {
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		grid-template-rows: repeat(10, 1fr);
		gap: 2px;
		width: 100%;
		height: 100%;
		max-height: calc(100vh - 130px);
		aspect-ratio: 10 / 7;
		max-width: 100%;
	}

	.cell {
		position: relative;
		min-width: 0;
		min-height: 0;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 3px;
		padding: 1px;
		overflow: hidden;
		transition: box-shadow 0.15s, border-color 0.15s;
	}

	.cell-card {
		width: 100%;
		height: 100%;
	}

	.cell.placement-target {
		border-color: #34d399;
		box-shadow:
			0 0 0 2px rgba(52, 211, 153, 0.85),
			0 0 16px rgba(52, 211, 153, 0.45);
		z-index: 1;
	}

	.placement-ring {
		position: absolute;
		inset: 2px;
		border: 2px solid #34d399;
		border-radius: 3px;
		pointer-events: none;
		z-index: 5;
		box-shadow: inset 0 0 10px rgba(52, 211, 153, 0.35);
		animation: pulse-target 1.4s ease-in-out infinite;
	}

	.cell.hovered {
		box-shadow:
			inset 0 0 0 2px #00f5ff,
			0 0 10px rgba(0, 245, 255, 0.45);
		z-index: 2;
	}

	.chip {
		position: absolute;
		width: 38%;
		height: 38%;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.55);
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
	}

	.chip.locked-chip {
		box-shadow: 0 0 5px gold;
	}

	.side-panel {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-height: 0;
		overflow: hidden;
	}

	.camera-box {
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid rgba(0, 245, 255, 0.25);
		background: #000;
		flex-shrink: 0;
	}

	.camera-preview {
		width: 100%;
		height: 90px;
		object-fit: cover;
		transform: scaleX(-1);
		display: block;
	}

	.cam-label {
		position: absolute;
		bottom: 2px;
		left: 4px;
		font-size: 0.5rem;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(0, 0, 0, 0.5);
		padding: 1px 4px;
		border-radius: 3px;
	}

	.gesture-guide {
		font-size: 0.55rem;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.45);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		padding: 0.4rem 0.5rem;
		flex-shrink: 0;
	}

	.gesture-guide p {
		margin: 0.15rem 0;
	}

	.hand-strip {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.hand-label {
		font-size: 0.55rem;
		color: rgba(255, 255, 255, 0.45);
		margin: 0 0 0.3rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		flex-shrink: 0;
	}

	.hand-cards {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-right: 2px;
	}

	.hand-card-wrap {
		position: relative;
		width: 100%;
		height: 72px;
		flex-shrink: 0;
		border-radius: 5px;
		border: 2px solid transparent;
		transition: border-color 0.15s, transform 0.15s;
	}

	.hand-card-wrap.hovered {
		border-color: #00f5ff;
		transform: scale(1.03);
		box-shadow: 0 0 12px rgba(0, 245, 255, 0.35);
	}

	.hand-card-wrap.dead {
		opacity: 0.7;
	}

	.dead-badge {
		position: absolute;
		bottom: 3px;
		right: 4px;
		font-size: 0.45rem;
		background: #ff4e4e;
		color: #fff;
		padding: 1px 4px;
		border-radius: 3px;
		z-index: 3;
	}

	.win-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 10000;
	}

	.win-overlay h2 {
		font-family: 'Syne', sans-serif;
		font-size: 2rem;
		color: #00f5ff;
		margin-bottom: 1rem;
	}

	.win-overlay button {
		padding: 0.65rem 1.5rem;
		background: #00f5ff;
		color: #070710;
		border: none;
		border-radius: 8px;
		font-family: 'Space Mono', monospace;
		font-weight: 700;
		cursor: pointer;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	@keyframes pulse-target {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (max-width: 720px) {
		.main-layout {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
		}

		.side-panel {
			flex-direction: row;
			flex-wrap: wrap;
			max-height: 28vh;
		}

		.hand-cards {
			flex-direction: row;
			overflow-x: auto;
			overflow-y: hidden;
		}

		.hand-card-wrap {
			width: 52px;
			height: 70px;
		}
	}
</style>
