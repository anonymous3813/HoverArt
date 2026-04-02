<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
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

	// ── Page / notebook state ────────────────────────────────────────────────
	interface Page {
		id: string;
		name: string;
		snapshot: string; // base64 PNG of this page's canvas
	}

	let pages = $state<Page[]>([{ id: crypto.randomUUID(), name: 'Page 1', snapshot: '' }]);
	let currentPageId = $state(pages[0].id);
	let sidebarOpen = $state(false);
	let editingPageId = $state<string | null>(null);
	let editingName = $state('');

	// Gesture hold state for L-shape sidebar toggle
	let lHoldStart = $state<number | null>(null);
	let lHoldProgress = $state(0); // 0–1 for the hold arc animation
	let lHoldTimer: ReturnType<typeof setInterval> | null = null;
	const L_HOLD_MS = 2000;

	// Gesture navigation: debounce so one sustained gesture = one action
	let lastNavGesture = $state('none');
	let navDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	const NAV_DEBOUNCE_MS = 800;

	function currentPageIndex() {
		return pages.findIndex((p) => p.id === currentPageId);
	}

	function switchToPage(id: string) {
		if (id === currentPageId) return;
		// Snapshot current canvas before leaving
		const snap = handCanvas?.getCanvasDataUrl() ?? '';
		pages = pages.map((p) => (p.id === currentPageId ? { ...p, snapshot: snap } : p));
		currentPageId = id;
		// Restore target page canvas after a tick
		setTimeout(() => {
			handCanvas?.clearCanvas(false);
			const target = pages.find((p) => p.id === id);
			if (target?.snapshot) handCanvas?.loadSnapshot(target.snapshot);
		}, 30);
	}

	function addPage() {
		const newPage: Page = { id: crypto.randomUUID(), name: `Page ${pages.length + 1}`, snapshot: '' };
		pages = [...pages, newPage];
		switchToPage(newPage.id);
	}

	function deletePage(id: string) {
		if (pages.length === 1) return;
		const idx = pages.findIndex((p) => p.id === id);
		const next = pages[idx === 0 ? 1 : idx - 1];
		pages = pages.filter((p) => p.id !== id);
		if (id === currentPageId) switchToPage(next.id);
	}

	function startEditing(page: Page) {
		editingPageId = page.id;
		editingName = page.name;
	}

	function commitEdit() {
		if (editingPageId && editingName.trim()) {
			pages = pages.map((p) => (p.id === editingPageId ? { ...p, name: editingName.trim() } : p));
		}
		editingPageId = null;
	}

	function navigatePages(direction: 'up' | 'down') {
		const idx = currentPageIndex();
		if (direction === 'up' && idx > 0) switchToPage(pages[idx - 1].id);
		if (direction === 'down' && idx < pages.length - 1) switchToPage(pages[idx + 1].id);
	}

	// ── Gesture handler ──────────────────────────────────────────────────────
	function handleGestureChange(g: string) {
		currentGesture = g;

		// L-shape hold → toggle sidebar
		if (g === 'l_shape') {
			if (lHoldStart === null) {
				lHoldStart = Date.now();
				lHoldTimer = setInterval(() => {
					const elapsed = Date.now() - (lHoldStart ?? Date.now());
					lHoldProgress = Math.min(elapsed / L_HOLD_MS, 1);
					if (lHoldProgress >= 1) {
						clearInterval(lHoldTimer!);
						lHoldTimer = null;
						lHoldStart = null;
						lHoldProgress = 0;
						sidebarOpen = !sidebarOpen;
					}
				}, 30);
			}
		} else {
			// Cancel hold if gesture changed
			if (lHoldTimer) { clearInterval(lHoldTimer); lHoldTimer = null; }
			lHoldStart = null;
			lHoldProgress = 0;
		}

		// Point up/down → navigate pages (only when sidebar is open)
		if (sidebarOpen && (g === 'point_up' || g === 'point_down')) {
			if (g !== lastNavGesture) {
				lastNavGesture = g;
				navigatePages(g === 'point_up' ? 'up' : 'down');
				if (navDebounceTimer) clearTimeout(navDebounceTimer);
				navDebounceTimer = setTimeout(() => { lastNavGesture = 'none'; }, NAV_DEBOUNCE_MS);
			}
		}
	}

	function handleStrokeComplete(stroke: { points: { x: number; y: number }[]; color: string; width: number }) {
		if (!isInRoom || !socket) return;
		socket.emit('stroke', { stroke });
	}

	onMount(() => {
		socket = io(BACKEND_URL, { autoConnect: true });

		socket.on('room-created', ({ code }: { code: string }) => { roomCode = code; isInRoom = true; roomError = ''; });
		socket.on('room-joined', ({ strokes, code }: { strokes: any[]; code: string }) => {
			roomCode = code; isInRoom = true; roomError = '';
			strokes.forEach((s) => handCanvas?.drawPeerStroke(s));
		});
		socket.on('room-error', ({ message }: { message: string }) => { roomError = message; });
		socket.on('room-left', () => { roomCode = ''; isInRoom = false; peerCount = 0; });
		socket.on('peer-count', ({ count }: { count: number }) => { peerCount = count; });
		socket.on('peer-stroke', ({ stroke }: { stroke: any }) => { handCanvas?.drawPeerStroke(stroke); });
		socket.on('peer-clear', () => { handCanvas?.clearFromPeer(); });
	});

	onDestroy(() => {
		socket?.disconnect();
		if (lHoldTimer) clearInterval(lHoldTimer);
		if (navDebounceTimer) clearTimeout(navDebounceTimer);
	});

	function createRoom() { roomError = ''; socket?.emit('create-room'); }
	function joinRoom() { if (!joinInput.trim()) return; roomError = ''; socket?.emit('join-room', { code: joinInput.trim() }); }
	function leaveRoom() { socket?.emit('leave-room'); joinInput = ''; }

	function handleClear() {
		handCanvas?.clearCanvas();
		if (isInRoom) socket?.emit('clear-canvas');
	}
	function handleGestureClear() { if (isInRoom) socket?.emit('clear-canvas'); }

	async function copyCode() {
		await navigator.clipboard.writeText(roomCode);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	function openShareModal() {
		shareEmail = ''; shareMessage = ''; shareStatus = 'idle'; shareError = '';
		showShareModal = true;
	}

	async function sendEmail() {
		if (!shareEmail.trim()) return;
		shareStatus = 'sending'; shareError = '';
		const imageData = handCanvas?.getCanvasDataUrl() ?? '';
		try {
			const res = await fetch(`${BACKEND_URL}/share-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ to: shareEmail.trim(), imageData, message: shareMessage.trim() })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Unknown error');
			shareStatus = 'sent';
			setTimeout(() => { showShareModal = false; shareStatus = 'idle'; }, 2000);
		} catch (err: any) {
			shareStatus = 'error'; shareError = err.message;
		}
	}
</script>

<svelte:head>
	<title>HoverArt — Gesture Canvas</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Share modal -->
{#if showShareModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
		<div class="w-full max-w-md rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl" style="font-family: 'Space Mono', monospace;">
			<h2 class="mb-1 text-lg font-bold text-white" style="font-family: 'Syne', sans-serif;">Share via Email</h2>
			<p class="mb-5 text-xs text-white/30">Your current canvas will be sent as an image.</p>
			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Recipient</label>
					<input type="email" placeholder="friend@example.com" bind:value={shareEmail} class="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30" />
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Message (optional)</label>
					<textarea placeholder="Check out what I made!" bind:value={shareMessage} rows="2" class="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"></textarea>
				</div>
				{#if shareStatus === 'error'}<p class="text-xs text-red-400">{shareError}</p>{/if}
				{#if shareStatus === 'sent'}<p class="text-xs text-[#4eff91]">✓ Email sent!</p>{/if}
			</div>
			<div class="mt-5 flex gap-2 justify-end">
				<button class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50 hover:text-white transition-colors" onclick={() => (showShareModal = false)} disabled={shareStatus === 'sending'}>Cancel</button>
				<button class="cursor-pointer rounded-lg border border-[#00f5ff]/30 bg-[#00f5ff]/10 px-5 py-2 text-xs text-[#00f5ff] transition-colors hover:border-[#00f5ff]/60 hover:bg-[#00f5ff]/20 disabled:opacity-40" onclick={sendEmail} disabled={shareStatus === 'sending' || shareStatus === 'sent' || !shareEmail.trim()}>
					{shareStatus === 'sending' ? 'Sending…' : 'Send'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Sidebar drawer ───────────────────────────────────────────────────── -->
<!-- Backdrop -->
{#if sidebarOpen}
	<div
		class="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
		role="button"
		tabindex="-1"
		aria-label="Close sidebar"
		onclick={() => (sidebarOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)}
	></div>
{/if}

<!-- Drawer panel -->
<aside
	class="sidebar-drawer fixed top-0 left-0 z-40 flex h-full w-72 flex-col border-r border-white/10 bg-[#0d0d14] shadow-2xl"
	style:transform={sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'}
	style="font-family: 'Space Mono', monospace; transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);"
>
	<!-- Drawer header -->
	<div class="flex items-center justify-between border-b border-white/10 px-5 py-4">
		<span class="text-base font-bold text-white" style="font-family: 'Syne', sans-serif;">Notebook</span>
		<button
			class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition-colors hover:text-white"
			onclick={() => (sidebarOpen = false)}
			aria-label="Close sidebar"
		>✕</button>
	</div>

	<!-- Gesture hint -->
	<div class="mx-4 mt-3 mb-1 rounded-lg border border-white/5 bg-white/3 px-3 py-2 text-[0.6rem] leading-relaxed text-white/20 uppercase tracking-widest">
		<span class="text-white/30">L</span> gesture · hold 2s to toggle<br />
		<span class="text-white/30">↑↓</span> point to navigate pages
	</div>

	<!-- Page list -->
	<nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
		{#each pages as page, i (page.id)}
			<div
				class="page-item group relative flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-150"
				class:active={page.id === currentPageId}
				onclick={() => { switchToPage(page.id); sidebarOpen = false; }}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && switchToPage(page.id)}
			>
				<!-- Thumbnail -->
				<div class="relative h-11 w-16 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-[#1a1a26]">
					{#if page.snapshot}
						<img src={page.snapshot} alt="Page thumbnail" class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-[0.5rem] text-white/15">empty</div>
					{/if}
					<!-- active indicator line -->
					{#if page.id === currentPageId}
						<div class="absolute inset-y-0 left-0 w-0.5 rounded-r bg-[#00f5ff]"></div>
					{/if}
				</div>

				<!-- Page name -->
				<div class="min-w-0 flex-1">
					{#if editingPageId === page.id}
						<input
							type="text"
							bind:value={editingName}
							class="w-full rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs text-white outline-none focus:border-[#00f5ff]/50"
							style="font-family: 'Space Mono', monospace;"
							onblur={commitEdit}
							onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') editingPageId = null; }}
							autofocus
							onclick|stopPropagation={() => {}}
						/>
					{:else}
						<p class="truncate text-xs" class:text-white={page.id === currentPageId} class:text-white/50={page.id !== currentPageId}>
							{page.name}
						</p>
						<p class="text-[0.55rem] text-white/20">Page {i + 1}</p>
					{/if}
				</div>

				<!-- Actions (show on hover) -->
				<div class="flex flex-shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						class="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[0.6rem] text-white/30 hover:text-[#00f5ff] transition-colors"
						onclick|stopPropagation={() => startEditing(page)}
						title="Rename"
					>✎</button>
					{#if pages.length > 1}
						<button
							class="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[0.6rem] text-white/30 hover:text-red-400 transition-colors"
							onclick|stopPropagation={() => deletePage(page.id)}
							title="Delete"
						>✕</button>
					{/if}
				</div>
			</div>
		{/each}
	</nav>

	<!-- Add page button -->
	<div class="border-t border-white/10 p-3">
		<button
			class="w-full cursor-pointer rounded-xl border border-dashed border-white/15 bg-white/3 py-2.5 text-xs text-white/30 transition-all hover:border-[#00f5ff]/30 hover:text-[#00f5ff]"
			style="font-family: 'Space Mono', monospace;"
			onclick={addPage}
		>
			+ New page
		</button>
	</div>
</aside>

<!-- ── Sidebar toggle tab (always visible on left edge) ──────────────────── -->
<button
	class="sidebar-tab fixed top-1/2 left-0 z-40 flex -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-1 rounded-r-xl border border-l-0 border-white/10 bg-[#0d0d14] px-2 py-4 text-white/30 transition-all hover:text-white/70"
	style:transform={sidebarOpen ? 'translateX(-100%) translateY(-50%)' : 'translateX(0) translateY(-50%)'}
	style="transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);"
	onclick={() => (sidebarOpen = true)}
	aria-label="Open notebook sidebar"
>
	<!-- L hold progress arc -->
	{#if lHoldProgress > 0}
		<svg width="24" height="24" viewBox="0 0 24 24" class="absolute" style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
			<circle cx="12" cy="12" r="10" fill="none" stroke="#00f5ff" stroke-width="2" stroke-dasharray="{lHoldProgress * 62.8} 62.8" stroke-linecap="round" transform="rotate(-90 12 12)" />
		</svg>
	{/if}
	<span class="text-[0.55rem] tracking-widest uppercase" style="writing-mode: vertical-rl; letter-spacing: 0.15em;">Pages</span>
	<span class="text-[0.6rem]">▶</span>
</button>

<!-- ── Main layout ───────────────────────────────────────────────────────── -->
<main
	class="mx-auto flex max-w-[1100px] flex-col gap-5 px-5 pt-6 pb-12"
	style="font-family: 'Space Mono', monospace;"
>
	<header class="flex items-center justify-between">
		<div>
			<h1 class="m-0 text-4xl font-extrabold tracking-tight text-white md:text-6xl" style="font-family: 'Syne', sans-serif;">
				Hover<span class="text-[#00f5ff]">Art</span>
			</h1>
			<p class="mt-1.5 text-xs tracking-widest text-white/30 uppercase">
				Draw with your hands. No touch required.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<!-- Current page breadcrumb -->
			<button
				class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
				onclick={() => (sidebarOpen = true)}
			>
				<span class="text-[#00f5ff]">≡</span>
				<span>{pages.find(p => p.id === currentPageId)?.name ?? 'Page'}</span>
				<span class="text-white/20">· {currentPageIndex() + 1}/{pages.length}</span>
			</button>
			{#if auth.user}
				<span class="text-xs text-white/40"><span class="text-white/60">{auth.user.username}</span></span>
				<button
					class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
					style="font-family: 'Space Mono', monospace;"
					onclick={() => { clearAuth(); goto('/login'); }}
				>Sign out</button>
			{/if}
		</div>
	</header>

	<div class="flex flex-wrap items-end gap-7 rounded-xl border border-white/10 bg-[#111118] px-5 py-4">
		<div class="flex flex-col gap-2">
			<label for="color-picker" class="text-[0.65rem] tracking-widest text-white/25 uppercase">
				Color {#if moodState === 'joyful'}<span class="ml-1 text-[#ffdd57]">· joyful palette</span>{/if}
			</label>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each presetColors as c (c)}
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
				<input type="color" bind:value={brushColor} class="h-6 w-6 cursor-pointer overflow-hidden rounded-full border-none bg-transparent p-0" title="Custom color" />
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<label for="brush-size" class="text-[0.65rem] tracking-widest text-white/25 uppercase">
				Size <span class="text-[#00f5ff]">{brushSize}px</span>
			</label>
			<input type="range" id="brush-size" min="1" max="30" bind:value={brushSize} class="slider h-1 w-36 cursor-pointer appearance-none rounded-sm bg-white/10 outline-none" />
		</div>

		<div class="ml-auto flex flex-row items-end gap-2">
			<button class="cursor-pointer rounded-lg border border-red-500/20 bg-white/5 px-4 py-2 text-xs text-red-400 transition-colors duration-150 hover:border-red-500/70 hover:bg-red-500/15" style="font-family: 'Space Mono', monospace;" onclick={handleClear}>Clear</button>
			<button class="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-[#e0e0e8] transition-colors duration-150 hover:border-white/30 hover:bg-white/10" style="font-family: 'Space Mono', monospace;" onclick={() => handCanvas?.exportCanvas()}>Export PNG</button>
			<button class="cursor-pointer rounded-lg border border-[#ff4ecd]/25 bg-[#ff4ecd]/5 px-4 py-2 text-xs text-[#ff4ecd] transition-colors duration-150 hover:border-[#ff4ecd]/55 hover:bg-[#ff4ecd]/10" style="font-family: 'Space Mono', monospace;" onclick={openShareModal}>Share ✉</button>
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
				<button class="cursor-pointer rounded-lg border border-[#00f5ff]/25 bg-[#00f5ff]/5 px-4 py-2 text-xs text-[#00f5ff] transition-colors hover:border-[#00f5ff]/60 hover:bg-[#00f5ff]/10" style="font-family: 'Space Mono', monospace;" onclick={createRoom}>Create Room</button>
				<div class="flex gap-2">
					<input class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/25" style="font-family: 'Space Mono', monospace;" placeholder="Room code" bind:value={joinInput} onkeydown={(e) => e.key === 'Enter' && joinRoom()} />
					<button class="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-[#e0e0e8] transition-colors hover:border-white/30 hover:bg-white/10" style="font-family: 'Space Mono', monospace;" onclick={joinRoom}>Join</button>
				</div>
				{#if roomError}<span class="w-full text-xs text-red-400">{roomError}</span>{/if}
			</div>
		{:else}
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-xs text-white/40">Room code:</span>
				<span class="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold tracking-[0.2em] text-white">{roomCode}</span>
				<button class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition-colors hover:border-white/25 hover:bg-white/10" style="font-family: 'Space Mono', monospace; color: {copied ? '#4eff91' : '#e0e0e8'};" onclick={copyCode}>{copied ? '✓ Copied' : 'Copy'}</button>
				<button class="ml-auto cursor-pointer rounded-lg border border-red-500/20 bg-white/5 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10" style="font-family: 'Space Mono', monospace;" onclick={leaveRoom}>Leave</button>
			</div>
		{/if}
	</div>

	<!-- L-hold progress indicator (shown near canvas when gesture is active) -->
	{#if lHoldProgress > 0}
		<div class="flex items-center gap-3 rounded-lg border border-[#00f5ff]/20 bg-[#00f5ff]/5 px-4 py-2">
			<svg width="20" height="20" viewBox="0 0 20 20">
				<circle cx="10" cy="10" r="8" fill="none" stroke="#00f5ff22" stroke-width="2" />
				<circle cx="10" cy="10" r="8" fill="none" stroke="#00f5ff" stroke-width="2" stroke-dasharray="{lHoldProgress * 50.3} 50.3" stroke-linecap="round" transform="rotate(-90 10 10)" />
			</svg>
			<span class="text-xs text-[#00f5ff]/70">Hold L-shape… {Math.round(lHoldProgress * 100)}%</span>
		</div>
	{/if}

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
		<div class="rounded-full transition-all duration-100" style:width="{brushSize * 2}px" style:height="{brushSize * 2}px" style:background={brushColor} style:min-width="2px" style:min-height="2px"></div>
		<span>Brush preview</span>
		<span class="ml-auto text-white/10">gesture: {currentGesture}</span>
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

	.page-item {
		border-color: transparent;
		background: transparent;
	}
	.page-item:hover {
		border-color: rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}
	.page-item.active {
		border-color: rgba(0, 245, 255, 0.2);
		background: rgba(0, 245, 255, 0.05);
	}
</style>