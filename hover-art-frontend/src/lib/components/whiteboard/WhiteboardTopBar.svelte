<script lang="ts">
	export let scene: any;
	export let room: any;
	export let notebook: any;
	export let onToggleCollab: () => void = () => {};
	export let onOpenShare: () => void = () => {};
	export let onClear: () => void = () => {};
	export let onUndo: () => void = () => {};
	export let onRedo: () => void = () => {};
	export let onResetView: () => void = () => {};
</script>

<header class="fixed top-0 inset-x-0 z-20 h-12 flex items-center justify-between px-3
               bg-[#070710]/90 backdrop-blur-md border-b border-white/10">
	<div class="flex items-center gap-1 shrink-0">
		<span class="text-[17px] font-bold text-white px-1" style="font-family:'Syne',sans-serif;">
			Hover<span class="text-[#00f5ff]">Art</span>
		</span>
		<div class="w-px h-5 bg-white/10 mx-1"></div>
		<button
			class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white/40
			       hover:bg-white/5 hover:text-white/70 transition-colors cursor-pointer"
			onclick={() => (notebook.sidebarOpen = true)}
		>
			<span class="text-[#00f5ff]/60">≡</span>
			{notebook.currentPage()?.name ?? 'Page'}
			<span class="text-white/20">· {notebook.currentPageIndex() + 1}/{notebook.pages.length}</span>
		</button>
		<div class="w-px h-5 bg-white/10 mx-1"></div>
		<button
			class="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors cursor-pointer
			       {scene.canUndo ? 'text-white/50 hover:bg-white/5 hover:text-white/80' : 'text-white/15 cursor-not-allowed'}"
			disabled={!scene.canUndo}
			onclick={onUndo}
		>↩</button>
		<button
			class="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors cursor-pointer
			       {scene.canRedo ? 'text-white/50 hover:bg-white/5 hover:text-white/80' : 'text-white/15 cursor-not-allowed'}"
			disabled={!scene.canRedo}
			onclick={onRedo}
		>↪</button>
		<span class="text-[11px] text-white/20 min-w-[42px] text-center tabular-nums">
			{Math.round(scene.transform.scale * 100)}%
		</span>
		<button
			class="w-7 h-7 flex items-center justify-center rounded-md text-xs text-white/25
			       hover:bg-white/5 hover:text-white/60 transition-colors cursor-pointer"
			onclick={onResetView}
			title="Reset view"
		>⊙</button>
	</div>

	<div class="flex items-center gap-2 shrink-0">
		{#if room.isInRoom}
			<button
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
				       bg-green-500/10 text-green-400 border border-green-500/20
				       hover:bg-green-500/20 transition-colors cursor-pointer"
				onclick={onToggleCollab}
			>
				<span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
				{room.peerCount} in room · <strong>{room.roomCode}</strong>
				<span class="text-green-600">⌄</span>
			</button>
		{:else}
			<button
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white/35
				       hover:bg-white/5 hover:text-white/70 transition-colors cursor-pointer"
				onclick={onToggleCollab}
			>
				<span class="w-1.5 h-1.5 rounded-full bg-white/20"></span>
				Collaborate <span class="text-white/20">⌄</span>
			</button>
		{/if}
		<button
			class="px-2.5 py-1 rounded-md text-xs text-white/35
			       hover:bg-white/5 hover:text-white/70 transition-colors cursor-pointer"
			onclick={onOpenShare}
		>Share ✉</button>
		<button
			class="px-2.5 py-1 rounded-md text-xs text-red-400/50
			       hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
			onclick={onClear}
		>Clear</button>
	</div>
</header>
