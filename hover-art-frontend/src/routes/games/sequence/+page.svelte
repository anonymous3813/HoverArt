<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import SequenceGame from './SequenceGame.svelte';
	import GameLobby from '$lib/components/GameLobby.svelte';
	import WaitingRoom from '$lib/components/WaitingRoom.svelte';
	import { gameSocket } from '$lib/services/gameSocket.ts';
	import type { SequenceGameState } from './sequenceEngine.ts';
	import { getPublicState } from './sequenceEngine.ts';

	import type { AiDifficulty } from './sequenceAI.ts';

	type GamePhase = 'lobby' | 'waiting' | 'playing' | 'solo';

	let gamePhase: GamePhase = $state('lobby');
	let roomCode = $state('');
	let players: { id: string; name: string; ready?: boolean }[] = $state([]);
	let isHost = $state(false);
	let playerName = $state('');
	let aiDifficulty: AiDifficulty = $state('medium');
	let sequenceState: SequenceGameState | null = $state(null);

	onMount(() => {
		gameSocket.connect();
		gameSocket.onPlayersUpdate((data) => {
			players = data.players;
		});
		gameSocket.onGameStart((data) => {
			if (data?.gameState?.sequence && gameSocket.playerId) {
				sequenceState = getPublicState(data.gameState.sequence, gameSocket.playerId) as SequenceGameState;
			}
			gamePhase = 'playing';
		});
		gameSocket.onSequenceState((payload) => {
			if (payload.state) sequenceState = payload.state;
		});
		gameSocket.onPlayerLeft(() => {
			if (gamePhase === 'playing') {
				alert('A player left the game.');
				handleBackToLobby();
			}
		});
	});

	onDestroy(() => {
		if (gamePhase !== 'solo' && gamePhase !== 'lobby') {
			gameSocket.leaveRoom();
		}
		gameSocket.offAll();
	});

	function handleRoomCreated(event: CustomEvent<{ code: string; playerId: string; playerName?: string }>) {
		roomCode = event.detail.code;
		isHost = true;
		playerName = event.detail.playerName ?? '';
		gamePhase = 'waiting';
	}

	function handleRoomJoined(event: CustomEvent<{ code: string; playerId: string; playerName?: string }>) {
		roomCode = event.detail.code;
		isHost = false;
		playerName = event.detail.playerName ?? '';
		gamePhase = 'waiting';
	}

	function handlePlaySolo(event: CustomEvent<{ playerName?: string; difficulty?: AiDifficulty }>) {
		playerName = event.detail?.playerName ?? playerName ?? 'You';
		aiDifficulty = event.detail?.difficulty ?? 'medium';
		gamePhase = 'solo';
	}

	function handleBackToLobby() {
		gameSocket.leaveRoom();
		roomCode = '';
		players = [];
		isHost = false;
		playerName = '';
		sequenceState = null;
		gamePhase = 'lobby';
	}
</script>

<svelte:head>
	<title>HoverArt — Sequence</title>
</svelte:head>

<a
	href="/games"
	class="home-link"
>
	← Games
</a>

{#if gamePhase === 'lobby'}
	<GameLobby
		gameType="sequence"
		on:roomCreated={handleRoomCreated}
		on:roomJoined={handleRoomJoined}
		on:playSolo={handlePlaySolo}
	/>
{:else if gamePhase === 'waiting'}
	<WaitingRoom
		{roomCode}
		{players}
		{isHost}
		gameType="sequence"
		on:leave={handleBackToLobby}
	/>
{:else if gamePhase === 'playing'}
	<SequenceGame
		multiplayer={true}
		{roomCode}
		{players}
		playerId={gameSocket.playerId ?? ''}
		{playerName}
		initialState={sequenceState}
		on:gameOver={() => {}}
		on:back={handleBackToLobby}
	/>
{:else if gamePhase === 'solo'}
	<SequenceGame
		multiplayer={false}
		vsAi={true}
		{playerName}
		{aiDifficulty}
		on:back={handleBackToLobby}
	/>
{/if}

<style>
	.home-link {
		position: fixed;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 60;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.45);
		padding: 0.4rem 0.75rem;
		font-size: 0.7rem;
		color: rgba(0, 245, 255, 0.9);
		text-decoration: none;
		font-family: 'Space Mono', monospace;
		backdrop-filter: blur(4px);
	}
</style>
