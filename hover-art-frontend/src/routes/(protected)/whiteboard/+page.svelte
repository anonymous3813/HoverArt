<script lang="ts">import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { io, type Socket } from 'socket.io-client';
import HandCanvas from '$lib/components/HandCanvas.svelte';
import { auth, clearAuth } from '$lib/auth.svelte.ts';
const BACKEND_URL = 'http://localhost:3001';
const JOYFUL_COLORS = ['#ff6b35', '#ffdd57', '#ff4ecd', '#ff8c00', '#ff3366', '#ffd700', '#ff69b4', '#ff4500'];
const NEUTRAL_COLORS = ['#ffffff', '#00f5ff', '#ff4ecd', '#ffdd57', '#4eff91', '#ff6b35', '#a78bfa', '#f87171'];
let brushColor = $state('#00f5ff');
let brushSize = $state(4);
let moodState = $state<'joyful' | 'neutral'>('neutral');
let handCanvas: HandCanvas | null = null;
let currentGesture = $state('none');
let presetColors = $derived(moodState === 'joyful' ? JOYFUL_COLORS : NEUTRAL_COLORS);
let socket: Socket | null = null;
let roomCode = $state('');
let joinInput = $state('');
let isInRoom = $state(false);
let peerCount = $state(0);
let roomError = $state('');
let copied = $state(false);
let showShareModal = $state(false);
let shareEmail = $state('');
let shareMessage = $state('');
let shareStatus = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
let shareError = $state('');
function handleGestureChange(g: string) {
    currentGesture = g;
}
function handleStrokeComplete(stroke: {
    points: {
        x: number;
        y: number;
    }[];
    color: string;
    width: number;
}) {
    if (!isInRoom || !socket)
        return;
    socket.emit('stroke', { stroke });
}
onMount(() => {
    socket = io(BACKEND_URL, { autoConnect: true });
    socket.on('room-created', ({ code }: {
        code: string;
    }) => {
        roomCode = code;
        isInRoom = true;
        roomError = '';
    });
    socket.on('room-joined', ({ strokes, code }: {
        strokes: any[];
        code: string;
    }) => {
        roomCode = code;
        isInRoom = true;
        roomError = '';
        strokes.forEach((s) => handCanvas?.drawPeerStroke(s));
    });
    socket.on('room-error', ({ message }: {
        message: string;
    }) => {
        roomError = message;
    });
    socket.on('room-left', () => {
        roomCode = '';
        isInRoom = false;
        peerCount = 0;
    });
    socket.on('peer-count', ({ count }: {
        count: number;
    }) => {
        peerCount = count;
    });
    socket.on('peer-stroke', ({ stroke }: {
        stroke: any;
    }) => {
        handCanvas?.drawPeerStroke(stroke);
    });
    socket.on('peer-clear', () => {
        handCanvas?.clearFromPeer();
    });
});
onDestroy(() => {
    socket?.disconnect();
});
function createRoom() {
    roomError = '';
    socket?.emit('create-room');
}
function joinRoom() {
    if (!joinInput.trim())
        return;
    roomError = '';
    socket?.emit('join-room', { code: joinInput.trim() });
}
function leaveRoom() {
    socket?.emit('leave-room');
    joinInput = '';
}
function handleClear() {
    handCanvas?.clearCanvas();
    if (isInRoom)
        socket?.emit('clear-canvas');
}
function handleGestureClear() {
    if (isInRoom)
        socket?.emit('clear-canvas');
}
async function copyCode() {
    await navigator.clipboard.writeText(roomCode);
    copied = true;
    setTimeout(() => (copied = false), 1800);
}
function openShareModal() {
    shareEmail = '';
    shareMessage = '';
    shareStatus = 'idle';
    shareError = '';
    showShareModal = true;
}
async function sendEmail() {
    if (!shareEmail.trim())
        return;
    shareStatus = 'sending';
    shareError = '';
    const imageData = handCanvas?.getCanvasDataUrl() ?? '';
    try {
        const res = await fetch(`${BACKEND_URL}/share-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: shareEmail.trim(), imageData, message: shareMessage.trim() })
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error ?? 'Unknown error');
        shareStatus = 'sent';
        setTimeout(() => { showShareModal = false; shareStatus = 'idle'; }, 2000);
    }
    catch (err: any) {
        shareStatus = 'error';
        shareError = err.message;
    }
}
</script>

<svelte:head>
	<title>HoverArt — Gesture Canvas</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#if showShareModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-md rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl"
			style="font-family: 'Space Mono', monospace;"
		>
			<h2 class="mb-1 text-lg font-bold text-white" style="font-family: 'Syne', sans-serif;">
				Share via Email
			</h2>
			<p class="mb-5 text-xs text-white/30">Your current canvas will be sent as an image.</p>

			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Recipient</label>
					<input
						type="email"
						placeholder="friend@example.com"
						bind:value={shareEmail}
						class="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Message (optional)</label>
					<textarea
						placeholder="Check out what I made!"
						bind:value={shareMessage}
						rows="2"
						class="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
					></textarea>
				</div>

				{#if shareStatus === 'error'}
					<p class="text-xs text-red-400">{shareError}</p>
				{/if}
				{#if shareStatus === 'sent'}
					<p class="text-xs text-[#4eff91]">✓ Email sent!</p>
				{/if}
			</div>

			<div class="mt-5 flex gap-2 justify-end">
				<button
					class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50 hover:text-white transition-colors"
					onclick={() => (showShareModal = false)}
					disabled={shareStatus === 'sending'}
				>
					Cancel
				</button>
				<button
					class="cursor-pointer rounded-lg border border-[#00f5ff]/30 bg-[#00f5ff]/10 px-5 py-2 text-xs text-[#00f5ff] transition-colors hover:border-[#00f5ff]/60 hover:bg-[#00f5ff]/20 disabled:opacity-40"
					onclick={sendEmail}
					disabled={shareStatus === 'sending' || shareStatus === 'sent' || !shareEmail.trim()}
				>
					{shareStatus === 'sending' ? 'Sending…' : 'Send'}
				</button>
			</div>
		</div>
	</div>
{/if}

<main
	class="mx-auto flex max-w-[1100px] flex-col gap-5 px-5 pt-6 pb-12"
	style="font-family: 'Space Mono', monospace;"
>
	<header class="flex items-center justify-between">
		<div>
			<h1
				class="m-0 text-4xl font-extrabold tracking-tight text-white md:text-6xl"
				style="font-family: 'Syne', sans-serif;"
			>
				Hover<span class="text-[#00f5ff]">Art</span>
			</h1>
			<p class="mt-1.5 text-xs tracking-widest text-white/30 uppercase">
				Draw with your hands. No touch required.
			</p>
		</div>
		{#if auth.user}
			<div class="flex items-center gap-3">
				<span class="text-xs text-white/40">
					<span class="text-white/60">{auth.user.username}</span>
				</span>
				<button
					class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
					style="font-family: 'Space Mono', monospace;"
					onclick={() => { clearAuth(); goto('/login'); }}
				>
					Sign out
				</button>
			</div>
		{/if}
	</header>

	<div
		class="flex flex-wrap items-end gap-7 rounded-xl border border-white/10 bg-[#111118] px-5 py-4"
	>
		<div class="flex flex-col gap-2">
			<label for="color-picker" class="text-[0.65rem] tracking-widest text-white/25 uppercase">
				Color
				{#if moodState === 'joyful'}
					<span class="ml-1 text-[#ffdd57]">· joyful palette</span>
				{/if}
			</label>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each presetColors as c}
					<button
						class="h-6 w-6 cursor-pointer rounded-full border-2 p-0 transition-transform duration-150 hover:scale-125"
						class:scale-125={brushColor === c}
						class:border-white={brushColor === c}
						class:border-transparent={brushColor !== c}
						style:background={c}
						onclick={() => (brushColor = c)}
						aria-label={c}
					></button>
				{/each}
				<input
					type="color"
					bind:value={brushColor}
					class="h-6 w-6 cursor-pointer overflow-hidden rounded-full border-none bg-transparent p-0"
					title="Custom color"
				/>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<label for="brush-size" class="text-[0.65rem] tracking-widest text-white/25 uppercase">
				Size <span class="text-[#00f5ff]">{brushSize}px</span>
			</label>
			<input
				type="range"
				id="brush-size"
				min="1"
				max="30"
				bind:value={brushSize}
				class="slider h-1 w-36 cursor-pointer appearance-none rounded-sm bg-white/10 outline-none"
			/>
		</div>

		<div class="ml-auto flex flex-row items-end gap-2">
			<button
				class="cursor-pointer rounded-lg border border-red-500/20 bg-white/5 px-4 py-2 text-xs text-red-400 transition-colors duration-150 hover:border-red-500/70 hover:bg-red-500/15"
				style="font-family: 'Space Mono', monospace;"
				onclick={handleClear}
			>
				Clear
			</button>
			<button
				class="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-[#e0e0e8] transition-colors duration-150 hover:border-white/30 hover:bg-white/10"
				style="font-family: 'Space Mono', monospace;"
				onclick={() => handCanvas?.exportCanvas()}
			>
				Export PNG
			</button>
			<button
				class="cursor-pointer rounded-lg border border-[#ff4ecd]/25 bg-[#ff4ecd]/5 px-4 py-2 text-xs text-[#ff4ecd] transition-colors duration-150 hover:border-[#ff4ecd]/55 hover:bg-[#ff4ecd]/10"
				style="font-family: 'Space Mono', monospace;"
				onclick={openShareModal}
			>
				Share ✉
			</button>
		</div>
	</div>

	<div class="rounded-xl border border-white/10 bg-[#111118] px-5 py-4">
		<div class="mb-3 flex items-center justify-between">
			<span class="text-[0.65rem] tracking-widest text-white/25 uppercase">Collaborate</span>
			{#if isInRoom}
				<span class="flex items-center gap-1.5 text-xs text-[#4eff91]">
					<span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#4eff91]"></span>
					{peerCount} {peerCount === 1 ? 'person' : 'people'} in room
				</span>
			{:else}
				<span class="flex items-center gap-1.5 text-xs text-white/20">
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-white/20"></span>
					Not in a room
				</span>
			{/if}
		</div>

		{#if !isInRoom}
			<div class="flex flex-wrap gap-3">
				<button
					class="cursor-pointer rounded-lg border border-[#00f5ff]/25 bg-[#00f5ff]/5 px-4 py-2 text-xs text-[#00f5ff] transition-colors hover:border-[#00f5ff]/60 hover:bg-[#00f5ff]/10"
					style="font-family: 'Space Mono', monospace;"
					onclick={createRoom}
				>
					Create Room
				</button>
				<div class="flex gap-2">
					<input
						class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/25"
						style="font-family: 'Space Mono', monospace;"
						placeholder="Room code"
						bind:value={joinInput}
						onkeydown={(e) => e.key === 'Enter' && joinRoom()}
					/>
					<button
						class="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-[#e0e0e8] transition-colors hover:border-white/30 hover:bg-white/10"
						style="font-family: 'Space Mono', monospace;"
						onclick={joinRoom}
					>
						Join
					</button>
				</div>
				{#if roomError}
					<span class="w-full text-xs text-red-400">{roomError}</span>
				{/if}
			</div>
		{:else}
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-xs text-white/40">Room code:</span>
				<span class="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold tracking-[0.2em] text-white">
					{roomCode}
				</span>
				<button
					class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition-colors hover:border-white/25 hover:bg-white/10"
					style="font-family: 'Space Mono', monospace; color: {copied ? '#4eff91' : '#e0e0e8'};"
					onclick={copyCode}
				>
					{copied ? '✓ Copied' : 'Copy'}
				</button>
				<button
					class="ml-auto cursor-pointer rounded-lg border border-red-500/20 bg-white/5 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10"
					style="font-family: 'Space Mono', monospace;"
					onclick={leaveRoom}
				>
					Leave
				</button>
			</div>
		{/if}
	</div>

	<div class="overflow-hidden rounded-xl border border-white/10 shadow-[0_0_60px_#00f5ff0a]">
		<HandCanvas
			bind:this={handCanvas}
			bind:brushColor
			bind:brushSize
			bind:moodState
			onGestureChange={handleGestureChange}
			onStrokeComplete={handleStrokeComplete}
			onClear={handleGestureClear}
		/>
	</div>

	<div class="flex items-center gap-3 pl-1 text-[0.7rem] text-white/20">
		<div
			class="rounded-full transition-all duration-100"
			style:width="{brushSize * 2}px"
			style:height="{brushSize * 2}px"
			style:background={brushColor}
			style:min-width="2px"
			style:min-height="2px"
		></div>
		<span>Brush preview</span>
	</div>
</main>

<style>
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #00f5ff;
		cursor: pointer;
	}
</style>
