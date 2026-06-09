<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import HandCanvas from '$lib/components/HandCanvas.svelte';
	import { auth, clearAuth } from '$lib/auth.svelte.ts';
	import { getBackendUrl } from '$lib/backendUrl';
	import { createGestureStore } from '$lib/stores/gestures.svelte.ts';
	import { createNotebookStore, type CanvasHandle } from '$lib/stores/notebook.svelte.ts';
	import { createRoomStore } from '$lib/stores/room.svelte.ts';

	const BACKEND_URL = getBackendUrl();

	const JOYFUL_COLORS = [
		'#ff6b35',
		'#ffdd57',
		'#ff4ecd',
		'#ff8c00',
		'#ff3366',
		'#ffd700',
		'#ff69b4',
		'#ff4500'
	];
	const NEUTRAL_COLORS = [
		'#ffffff',
		'#00f5ff',
		'#ff4ecd',
		'#ffdd57',
		'#4eff91',
		'#ff6b35',
		'#a78bfa',
		'#f87171'
	];

	let brushColor = $state('#00f5ff');
	let brushSize = $state(6);
	let moodState = $state<'joyful' | 'neutral'>('neutral');
	let handCanvas: HandCanvas | null = null;
	let currentGesture = $state('none');
	let activeTool = $state<'select' | 'draw' | 'erase'>('draw');
	let presetColors = $derived(moodState === 'joyful' ? JOYFUL_COLORS : NEUTRAL_COLORS);

	const notebook = createNotebookStore(() => handCanvas as CanvasHandle | null);
	const room = createRoomStore();
	const gesture = createGestureStore({
		onLHoldComplete: () => {
			notebook.sidebarOpen = !notebook.sidebarOpen;
		},
		onPinkyHoldComplete: () => {
			notebook.addPage();
		},
		onQuietCoyoteHoldComplete: () => {
			notebook.sidebarOpen = false;
		},
		onNavGesture: (direction) => {
			notebook.navigatePages(direction);
		}
	});

	let showShareModal = $state(false);
	let showCollabPopover = $state(false);
	let copied = $state(false);
	let shareEmail = $state('');
	let shareMessage = $state('');
	let shareStatus = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let shareError = $state('');

	function handleGestureChange(g: string) {
		currentGesture = g;
		gesture.handleGestureChange(g, notebook.sidebarOpen);
	}

	function handleStrokeComplete(stroke: {
		points: { x: number; y: number }[];
		color: string;
		width: number;
	}) {
		room.emitStroke(stroke);
	}

	function handleClear() {
		handCanvas?.clearCanvas();
		room.emitClear();
	}

	function createRoom() {
		room.createRoom();
	}

	function joinRoom() {
		room.joinRoom();
	}

	function leaveRoom() {
		room.leaveRoom();
	}

	async function copyCode() {
		await navigator.clipboard.writeText(room.roomCode);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	function openShare() {
		shareEmail = '';
		shareMessage = '';
		shareStatus = 'idle';
		shareError = '';
		showShareModal = true;
	}

	async function sendEmail() {
		if (!shareEmail.trim()) return;
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
			if (!res.ok) throw new Error(data.error ?? 'Unknown error');
			shareStatus = 'sent';
			setTimeout(() => {
				showShareModal = false;
				shareStatus = 'idle';
			}, 2000);
		} catch (err: any) {
			shareStatus = 'error';
			shareError = err.message;
		}
	}

	onMount(() => {
		room.init(
			(stroke) => handCanvas?.drawPeerStroke(stroke),
			() => handCanvas?.clearFromPeer(),
		);
	});

	onDestroy(() => {
		room.destroy();
		gesture.destroy();
	});
</script>

<svelte:head>
	<title>HoverArt</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<!-- ── CANVAS ────────────────────────────────────────────────────────────── -->
<div class="fixed inset-0 z-0">
	<HandCanvas
		bind:this={handCanvas}
		bind:brushColor
		bind:brushSize
		bind:moodState
		onGestureChange={handleGestureChange}
		onStrokeComplete={handleStrokeComplete}
		onClear={handleClear}
	/>
</div>

<!-- ── TOP BAR ───────────────────────────────────────────────────────────── -->
<!--
	Three zones: [left: logo + pages] [center: tools] [right: room + share + user]
	All in one fixed bar so nothing overlaps the canvas edges.
-->
<header
	class="fixed inset-x-0 top-0 z-20 flex h-12 items-center
               border-b border-white/10 bg-[#070710]/90 backdrop-blur-md"
>
	<!-- LEFT: logo + page nav ─────────────────────────────────────────────── -->
	<div class="flex shrink-0 items-center gap-1 px-2">
		<a
			href="/"
			class="px-1.5 text-[17px] font-bold text-white no-underline hover:opacity-80"
			style="font-family:'Syne',sans-serif;"
		>
			Hover<span class="text-[#00f5ff]">Art</span>
		</a>

		<div class="mx-1 h-5 w-px bg-white/10"></div>

		<!-- Pages button (opens sidebar) -->
		<button
			class="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs
			       text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
			onclick={() => (notebook.sidebarOpen = true)}
		>
			<span class="text-[#00f5ff]/70">≡</span>
			{notebook.pages.find((p) => p.id === notebook.currentPageId)?.name ?? 'Page'}
			<span class="text-white/25">· {notebook.currentPageIndex() + 1}/{notebook.pages.length}</span>
		</button>

		<div class="mx-1 h-5 w-px bg-white/10"></div>

		<!-- Undo / Redo -->
		<button
			class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-sm
			       text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
			title="Undo"
			onclick={() => handCanvas?.undo?.()}>↩</button
		>
		<button
			class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-sm
			       text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
			title="Redo"
			onclick={() => handCanvas?.redo?.()}>↪</button
		>
	</div>

	<!-- CENTER: tool buttons ───────────────────────────────────────────────── -->
	<div class="flex flex-1 items-center justify-center gap-0.5">
		<div
			class="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-1"
		>
			<!-- Drawing tools -->
			<button
				class="top-tool-btn {activeTool === 'select' ? 'top-tool-active' : ''}"
				title="Select (S)"
				onclick={() => (activeTool = 'select')}>↖</button
			>
			<button
				class="top-tool-btn {activeTool === 'draw' ? 'top-tool-active' : ''}"
				title="Draw (D)"
				onclick={() => (activeTool = 'draw')}>✏</button
			>
			<button
				class="top-tool-btn {activeTool === 'erase' ? 'top-tool-active' : ''}"
				title="Erase (E)"
				onclick={() => (activeTool = 'erase')}>⬜</button
			>

			<div class="mx-1 h-5 w-px bg-white/10"></div>

			<!-- Gesture legend (read-only, just icons for reference) -->
			<button class="top-tool-btn cursor-default opacity-50" title="Index finger up = draw"
				>☝</button
			>
			<button class="top-tool-btn cursor-default opacity-50" title="Fist = undo">✊</button>
			<button class="top-tool-btn cursor-default opacity-50" title="Peace = erase">✌</button>

			<div class="mx-1 h-5 w-px bg-white/10"></div>

			<!-- Actions -->
			<button
				class="top-tool-btn text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
				title="Clear canvas"
				onclick={handleClear}>✕</button
			>
			<button class="top-tool-btn" title="Export PNG" onclick={() => handCanvas?.exportCanvas()}
				>↓</button
			>
		</div>
	</div>

	<!-- RIGHT: room + share + user ────────────────────────────────────────── -->
	<div class="flex shrink-0 items-center gap-2 px-2">
		{#if room.isInRoom}
			<button
				class="flex cursor-pointer items-center gap-1.5 rounded-md border border-green-500/20 bg-green-500/10
				       px-2.5 py-1 text-xs font-medium
				       text-green-400 transition-colors hover:bg-green-500/20"
				onclick={() => (showCollabPopover = !showCollabPopover)}
			>
				<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></span>
				{room.peerCount} in room · <strong>{room.roomCode}</strong>
				<span class="text-green-600">⌄</span>
			</button>
		{:else}
			<button
				class="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs
				       text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
				onclick={() => (showCollabPopover = !showCollabPopover)}
			>
				<span class="h-1.5 w-1.5 rounded-full bg-white/20"></span>
				Collaborate <span class="text-white/20">⌄</span>
			</button>
		{/if}

		<button
			class="cursor-pointer rounded-md px-2.5 py-1 text-xs
			       text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
			onclick={openShare}>Share ✉</button
		>

		{#if auth.user}
			<div
				class="flex h-7 w-7 cursor-default items-center justify-center
			            rounded-full border border-[#00f5ff]/20 bg-[#00f5ff]/10 text-[11px] font-bold
			            text-[#00f5ff]/70"
				title={auth.user.username}
			>
				{auth.user.username.slice(0, 2).toUpperCase()}
			</div>
			<button
				class="cursor-pointer rounded-md px-2.5 py-1 text-xs
				       text-white/25 transition-colors hover:bg-white/5 hover:text-white/50"
				onclick={() => {
					clearAuth();
					goto('/login');
				}}>Sign out</button
			>
		{/if}
	</div>
</header>

<!-- ── BRUSH BAR (bottom center) ────────────────────────────────────────── -->
<div
	class="fixed bottom-5 left-1/2 z-20 flex h-[52px] -translate-x-1/2 items-center rounded-2xl
            border border-white/10 bg-[#0d0d1a]/95 px-4 whitespace-nowrap backdrop-blur-md"
>
	<!-- Color swatches -->
	<div class="flex items-center gap-1.5 pr-1">
		{#each presetColors as c (c)}
			<button
				class="h-[22px] w-[22px] cursor-pointer rounded-full border-2 p-0
				       transition-transform hover:scale-125
				       {brushColor === c ? 'swatch-active scale-110' : 'border-transparent'}"
				style:background={c}
				onclick={() => (brushColor = c)}
				aria-label={c}
			></button>
		{/each}
		<label
			class="relative flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center
			       justify-center rounded-full border border-dashed border-white/20"
			title="Custom colour"
		>
			<span class="block h-3.5 w-3.5 rounded-full" style:background={brushColor}></span>
			<input type="color" class="absolute h-px w-px opacity-0" bind:value={brushColor} />
		</label>
	</div>

	<div class="mx-3.5 h-7 w-px bg-white/10"></div>

	<!-- Size slider -->
	<div class="flex items-center gap-2">
		<span class="text-[9px] tracking-widest text-white/25">SIZE</span>
		<input
			type="range"
			min="1"
			max="40"
			step="1"
			bind:value={brushSize}
			class="brush-slider w-[90px]"
		/>
		<span class="min-w-[28px] text-[11px] text-white/40">{brushSize}px</span>
	</div>

	<div class="mx-3.5 h-7 w-px bg-white/10"></div>

	<!-- Live preview dot -->
	<div
		class="shrink-0 rounded-full transition-all duration-150"
		style:width="{Math.max(brushSize * 1.5, 6)}px"
		style:height="{Math.max(brushSize * 1.5, 6)}px"
		style:max-width="36px"
		style:max-height="36px"
		style:background={brushColor}
	></div>
</div>

<!-- ── GESTURE HUD (bottom right) ───────────────────────────────────────── -->
<div
	class="fixed left-5 bottom-5 z-20 flex min-w-[150px] flex-col gap-1.5 rounded-xl border
            border-white/10 bg-[#0d0d1a]/95 px-3.5 py-2.5 backdrop-blur-md"
>
	<span class="text-[8px] tracking-[0.12em] text-white/25">GESTURE</span>
	<div
		class="flex items-center gap-1.5 text-[11px]
	            {currentGesture !== 'none' ? 'text-green-400' : 'text-white/30'}"
	>
		<span
			class="h-1.5 w-1.5 shrink-0 rounded-full
		             {currentGesture !== 'none' ? 'bg-green-500' : 'bg-white/15'}"
		></span>
		{currentGesture === 'none' ? 'none detected' : currentGesture.replace(/_/g, ' ')}
	</div>
	{#if gesture.lHoldProgress > 0}
		<div class="flex flex-col gap-1">
			<span class="text-[9px] text-white/25">sidebar toggle</span>
			<div class="h-[3px] overflow-hidden rounded-full bg-white/10">
				<div
					class="h-full rounded-full bg-[#00f5ff] transition-[width] duration-[50ms]"
					style:width="{gesture.lHoldProgress * 100}%"
				></div>
			</div>
		</div>
	{/if}
	{#if gesture.pinkyHoldProgress > 0}
		<div class="flex flex-col gap-1">
			<span class="text-[9px] text-white/25">new page</span>
			<div class="h-[3px] overflow-hidden rounded-full bg-white/10">
				<div
					class="h-full rounded-full bg-[#00f5ff] transition-[width] duration-[50ms]"
					style:width="{gesture.pinkyHoldProgress * 100}%"
				></div>
			</div>
		</div>
	{/if}
</div>

<!-- ── SIDEBAR BACKDROP ───────────────────────────────────────────────────── -->
{#if notebook.sidebarOpen}
	<div
		class="fixed inset-0 z-[28] bg-black/50 backdrop-blur-[2px]"
		role="button"
		tabindex="-1"
		aria-label="Close sidebar"
		onclick={() => (notebook.sidebarOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (notebook.sidebarOpen = false)}
	></div>
{/if}

<!-- ── SIDEBAR ────────────────────────────────────────────────────────────── -->
<aside
	class="fixed top-0 left-0 z-30 flex h-full w-[280px] flex-col
	       border-r border-white/10 bg-[#0a0a14]
	       transition-transform duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]
	       {notebook.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
	style="font-family:'Space Mono',monospace;"
>
	<div class="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
		<span class="text-[15px] font-bold text-white/90" style="font-family:'Syne',sans-serif;"
			>Notebook</span
		>
		<button
			class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border
			       border-white/10 bg-white/5 text-xs text-white/30 transition-colors hover:text-white/70"
			onclick={() => (notebook.sidebarOpen = false)}>✕</button
		>
	</div>

	<div
		class="mx-3.5 mt-2.5 mb-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2
	            text-[10px] leading-relaxed text-white/25"
	>
		<strong class="text-white/40">L</strong> gesture · hold 2s to toggle<br />
		<strong class="text-white/40">↑↓</strong> thumbs to navigate
	</div>

	<nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2">
		{#each notebook.pages as page, i (page.id)}
			<div
				class="group flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2
				       transition-all duration-100
				       {page.id === notebook.currentPageId
					? 'border-[#00f5ff]/20 bg-[#00f5ff]/5'
					: 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'}"
				role="button"
				tabindex="0"
				onclick={() => {
					notebook.switchToPage(page.id);
					notebook.sidebarOpen = false;
				}}
				onkeydown={(e) => e.key === 'Enter' && notebook.switchToPage(page.id)}
			>
				<div
					class="relative flex h-[42px] w-[60px] shrink-0 items-center
				            justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.04]"
				>
					{#if page.snapshot}
						<img src={page.snapshot} alt="thumbnail" class="h-full w-full object-cover" />
					{:else}
						<span class="text-[8px] text-white/20">empty</span>
					{/if}
					{#if page.id === notebook.currentPageId}
						<div class="absolute inset-y-0 left-0 w-[3px] rounded-r-sm bg-[#00f5ff]"></div>
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					{#if notebook.editingPageId === page.id}
						<input
							class="w-full rounded border border-[#00f5ff]/30 bg-white/[0.06] px-1.5 py-0.5
							       text-xs text-white/90 outline-none"
							type="text"
							bind:value={notebook.editingName}
							onblur={() => notebook.commitEdit()}
							onkeydown={(e) => {
								if (e.key === 'Enter') notebook.commitEdit();
								if (e.key === 'Escape') notebook.cancelEditing();
							}}
							autofocus
							onclick={(e) => e.stopPropagation()}
						/>
					{:else}
						<p
							class="m-0 truncate text-xs
						          {page.id === notebook.currentPageId ? 'text-white/90' : 'text-white/40'}"
						>
							{page.name}
						</p>
						<p class="m-0 mt-0.5 text-[10px] text-white/25">Page {i + 1}</p>
					{/if}
				</div>

				<div class="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						class="flex h-5 w-5 items-center justify-center rounded text-[11px] text-white/25
						       transition-colors hover:bg-[#00f5ff]/10 hover:text-[#00f5ff]"
						onclick={(e) => {
							e.stopPropagation();
							notebook.startEditing(page);
						}}
						title="Rename">✎</button
					>
					{#if notebook.pages.length > 1}
						<button
							class="flex h-5 w-5 items-center justify-center rounded text-[11px] text-white/25
							       transition-colors hover:bg-red-500/10 hover:text-red-400"
							onclick={(e) => {
								e.stopPropagation();
								notebook.deletePage(page.id);
							}}
							title="Delete">✕</button
						>
					{/if}
				</div>
			</div>
		{/each}
	</nav>

	<div class="border-t border-white/10 p-3">
		<button
			class="w-full cursor-pointer rounded-lg border border-dashed border-white/10 bg-transparent
			       py-2.5 text-xs text-white/25 transition-colors hover:border-[#00f5ff]/30
			       hover:text-[#00f5ff]/70"
			onclick={() => notebook.addPage()}>+ New page</button
		>
	</div>
</aside>

<!-- ── COLLABORATE POPOVER ───────────────────────────────────────────────── -->
{#if showCollabPopover}
	<div
		class="fixed top-14 right-3 z-40 w-[260px] rounded-xl border border-white/10 bg-[#0d0d1a]
	            shadow-2xl shadow-black/50"
	>
		<div class="flex items-center justify-between border-b border-white/10 px-4 py-3">
			<span class="text-[13px] font-bold text-white/80" style="font-family:'Syne',sans-serif;">
				Collaborate
			</span>
			<button
				class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-xs
				       text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
				onclick={() => (showCollabPopover = false)}>✕</button
			>
		</div>

		<div class="flex flex-col gap-2.5 p-4">
			{#if !room.isInRoom}
				<button
					class="cursor-pointer rounded-lg border border-[#00f5ff]/20 bg-[#00f5ff]/5 px-3.5 py-2
					       text-xs text-[#00f5ff]/80 transition-colors hover:bg-[#00f5ff]/10"
					style="font-family:'Space Mono',monospace;"
					onclick={createRoom}>Create room</button
				>

				<div class="flex gap-1.5">
					<input
						class="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5
						       text-xs text-white/80 transition-colors outline-none
						       placeholder:text-white/20 focus:border-[#00f5ff]/30"
						style="font-family:'Space Mono',monospace;"
						placeholder="Room code"
						bind:value={room.joinInput}
						onkeydown={(e) => e.key === 'Enter' && joinRoom()}
					/>
					<button
						class="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5
						       text-xs text-white/50 transition-colors hover:bg-white/[0.07]"
						style="font-family:'Space Mono',monospace;"
						onclick={joinRoom}>Join</button
					>
				</div>

				{#if room.roomError}<p class="m-0 text-[11px] text-red-400/80">{room.roomError}</p>{/if}
			{:else}
				<div class="flex items-center gap-2 text-xs text-green-400">
					<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"></span>
					{room.peerCount}
					{room.peerCount === 1 ? 'person' : 'people'} in room
				</div>

				<div class="flex items-center gap-2">
					<span
						class="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5
					             text-sm font-bold tracking-[0.15em] text-white/80"
					>
						{room.roomCode}
					</span>
					<button
						class="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5
						       text-xs transition-colors hover:bg-white/[0.07]
						       {copied ? 'text-green-400' : 'text-white/50'}"
						style="font-family:'Space Mono',monospace;"
						onclick={copyCode}>{copied ? '✓ Copied' : 'Copy'}</button
					>
				</div>

				<button
					class="cursor-pointer rounded-lg border border-red-500/20 bg-red-500/5 px-3.5 py-2
					       text-xs text-red-400/80 transition-colors hover:bg-red-500/10"
					style="font-family:'Space Mono',monospace;"
					onclick={leaveRoom}>Leave room</button
				>
			{/if}
		</div>
	</div>
{/if}

<!-- ── SHARE MODAL ────────────────────────────────────────────────────────── -->
{#if showShareModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) showShareModal = false;
		}}
	>
		<div class="w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0d0d1a]">
			<div class="flex items-start justify-between border-b border-white/[0.07] px-5 pt-5 pb-4">
				<div>
					<h2
						class="m-0 text-[15px] font-bold text-white/90"
						style="font-family:'Syne',sans-serif;"
					>
						Share via email
					</h2>
					<p class="m-0 mt-0.5 text-[11px] text-white/30">Your canvas will be sent as an image</p>
				</div>
				<button
					class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border
					       border-white/10 bg-white/5 text-xs text-white/30 transition-colors hover:text-white/70"
					onclick={() => (showShareModal = false)}>✕</button
				>
			</div>

			<div class="flex flex-col gap-3 px-5 py-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-[9px] tracking-[0.1em] text-white/25 uppercase">Recipient</label>
					<input
						type="email"
						class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px]
						       text-white/80 transition-colors outline-none
						       placeholder:text-white/20 focus:border-[#00f5ff]/30"
						style="font-family:'Space Mono',monospace;"
						placeholder="friend@example.com"
						bind:value={shareEmail}
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-[9px] tracking-[0.1em] text-white/25 uppercase"
						>Message (optional)</label
					>
					<textarea
						class="resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2
						       text-[13px] text-white/80 transition-colors
						       outline-none placeholder:text-white/20 focus:border-[#00f5ff]/30"
						style="font-family:'Space Mono',monospace;"
						rows="3"
						placeholder="Check out what I made!"
						bind:value={shareMessage}
					></textarea>
				</div>
				{#if shareStatus === 'error'}
					<p class="m-0 text-[11px] text-red-400/80">{shareError}</p>
				{/if}
				{#if shareStatus === 'sent'}
					<p class="m-0 text-[11px] text-green-400">✓ Email sent!</p>
				{/if}
			</div>

			<div class="flex justify-end gap-2 px-5 pb-5">
				<button
					class="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs
					       text-white/40 transition-colors hover:bg-white/[0.07] disabled:opacity-40"
					style="font-family:'Space Mono',monospace;"
					onclick={() => (showShareModal = false)}
					disabled={shareStatus === 'sending'}>Cancel</button
				>
				<button
					class="cursor-pointer rounded-lg border border-[#00f5ff]/20 bg-[#00f5ff]/5 px-4 py-2
					       text-xs text-[#00f5ff]/80 transition-colors hover:bg-[#00f5ff]/10
					       disabled:opacity-40"
					style="font-family:'Space Mono',monospace;"
					onclick={sendEmail}
					disabled={shareStatus === 'sending' || shareStatus === 'sent' || !shareEmail.trim()}
					>{shareStatus === 'sending' ? 'Sending…' : 'Send ✉'}</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Only what Tailwind can't do */

	:global(body) {
		margin: 0;
		overflow: hidden;
	}

	/* Active swatch: white inner border + cyan outer ring */
	.swatch-active {
		border-color: rgba(255, 255, 255, 0.9);
		outline: 2px solid #00f5ff;
		outline-offset: 1px;
	}

	/* Range slider thumb */
	.brush-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 3px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.1);
		outline: none;
		cursor: pointer;
	}
	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #0d0d1a;
		border: 2px solid #00f5ff;
		cursor: pointer;
	}

	/* Top toolbar button — shared base, avoids repeating long class strings */
	.top-tool-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 7px;
		border: none;
		background: transparent;
		font-size: 15px;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.45);
		transition:
			background 0.1s,
			color 0.1s;
	}
	.top-tool-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.8);
	}
	.top-tool-active {
		background: rgba(0, 245, 255, 0.1);
		color: #00f5ff;
	}
	.top-tool-active:hover {
		background: rgba(0, 245, 255, 0.15);
		color: #00f5ff;
	}
</style>
