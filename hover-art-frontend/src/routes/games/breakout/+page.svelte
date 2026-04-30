<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import FaceBreakoutGame from './FaceBreakoutGame.svelte';
	import GameLobby from '$lib/components/GameLobby.svelte';
	import WaitingRoom from '$lib/components/WaitingRoom.svelte';
	import { gameSocket } from '$lib/services/gameSocket';
	import { isLoggedIn } from '$lib/auth.svelte.ts';

	type GameState = 'lobby' | 'waiting' | 'playing' | 'solo';

	let gameState: GameState = 'lobby';
	let roomCode = '';
	let players: any[] = [];
	let isHost = false;
	let playerName = '';
	let gameStarted = false;

	onMount(() => {
		if (!isLoggedIn()) goto('/login');
		gameSocket.connect();
		gameSocket.onPlayersUpdate((data) => {
			players = data.players;
		});
		gameSocket.onGameStart(() => {
			gameStarted = true;
			gameState = 'playing';
		});
		gameSocket.onPlayerLeft(() => {
			if (gameState === 'playing') {
				alert('Other player left the game!');
				handleBackToLobby();
			}
		});
	});

	onDestroy(() => {
		if (gameState !== 'solo' && gameState !== 'lobby') {
			gameSocket.leaveRoom();
		}
		gameSocket.offAll();
	});

	function handleRoomCreated(event: CustomEvent<{ code: string; playerId: string; playerName?: string }>) {
		const { code, playerName: name } = event.detail;
		roomCode = code;
		isHost = true;
		playerName = name ?? '';
		gameState = 'waiting';
	}

	function handleRoomJoined(event: CustomEvent<{ code: string; playerId: string; playerName?: string }>) {
		const { code, playerName: name } = event.detail;
		roomCode = code;
		isHost = false;
		playerName = name ?? '';
		gameState = 'waiting';
	}

	function handlePlaySolo() {
		gameState = 'solo';
	}

	function handleBackToLobby() {
		gameSocket.leaveRoom();
		roomCode = '';
		players = [];
		isHost = false;
		playerName = '';
		gameStarted = false;
		gameState = 'lobby';
	}

	function handleGameOver() {
		setTimeout(() => {
			if (confirm('Game over! Return to lobby?')) {
				handleBackToLobby();
			}
		}, 3000);
	}
</script>

<svelte:head>
	<title>HoverArt — Face Breakout</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<a
	href="/"
	class="fixed top-3 left-3 z-[60] rounded-md border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-[#00f5ff]/90 backdrop-blur-sm hover:text-[#00f5ff]"
	style="font-family: 'Space Mono', monospace;"
>
	← Home
</a>

{#if gameState === 'lobby'}
	<GameLobby
		gameType="breakout"
		on:roomCreated={handleRoomCreated}
		on:roomJoined={handleRoomJoined}
		on:playSolo={handlePlaySolo}
	/>
{:else if gameState === 'waiting'}
	<WaitingRoom
		{roomCode}
		{players}
		{isHost}
		gameType="breakout"
		on:leave={handleBackToLobby}
	/>
{:else if gameState === 'playing'}
	<FaceBreakoutGame
		multiplayer={true}
		{roomCode}
		{players}
		{playerName}
		on:gameOver={handleGameOver}
	/>
{:else if gameState === 'solo'}
	<FaceBreakoutGame multiplayer={false} on:back={handleBackToLobby} />
{/if}
