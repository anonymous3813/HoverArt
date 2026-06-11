<script lang="ts">
	export let notebook: any;
	export let open = false;
	export let onClose: () => void = () => {};
</script>

{#if open}
	<div class="fixed inset-0 z-[28] bg-black/50 backdrop-blur-[2px]"
		role="button" tabindex="-1" aria-label="Close sidebar"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}></div>
{/if}
<aside class="fixed top-0 left-0 w-[280px] h-full z-30 flex flex-col bg-[#0a0a14]
              border-r border-white/10 transition-transform duration-[260ms]
              ease-[cubic-bezier(0.4,0,0.2,1)]
              {open ? 'translate-x-0' : '-translate-x-full'}"
	style="font-family:'Space Mono',monospace;">
	<div class="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
		<span class="text-[15px] font-bold text-white/90" style="font-family:'Syne',sans-serif;">Notebook</span>
		<button class="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10
		               bg-white/5 text-xs text-white/30 hover:text-white/70 cursor-pointer transition-colors"
			onclick={onClose}>✕</button>
	</div>
	<nav class="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-1">
		{#each notebook.pages as page, i (page.id)}
			<div
				class="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl border cursor-pointer
				       transition-all duration-100
				       {page.id === notebook.currentPageId
				         ? 'bg-[#00f5ff]/5 border-[#00f5ff]/20'
				         : 'border-transparent hover:bg-white/[0.03] hover:border-white/10'}"
				role="button" tabindex="0"
				onclick={() => { notebook.switchToPage(page.id); onClose(); }}
				onkeydown={(e) => e.key === 'Enter' && notebook.switchToPage(page.id)}
			>
				<div class="relative w-[60px] h-[42px] shrink-0 rounded-md overflow-hidden
				            bg-white/[0.04] border border-white/10 flex items-center justify-center">
					{#if page.thumbnail}
						<img src={page.thumbnail} alt="thumbnail" class="w-full h-full object-cover" />
					{:else}
						<span class="text-[8px] text-white/20">empty</span>
					{/if}
					{#if page.id === notebook.currentPageId}
						<div class="absolute left-0 inset-y-0 w-[3px] bg-[#00f5ff] rounded-r-sm"></div>
					{/if}
				</div>
				<div class="flex-1 min-w-0">
					{#if notebook.editingPageId === page.id}
						<input class="w-full text-xs border border-[#00f5ff]/30 rounded px-1.5 py-0.5
						              outline-none bg-white/[0.06] text-white/90"
							style="font-family:'Space Mono',monospace;" type="text"
							bind:value={notebook.editingName}
							onblur={notebook.commitEdit}
							onkeydown={(e) => { if (e.key === 'Enter') notebook.commitEdit(); if (e.key === 'Escape') notebook.editingName = ''; }}
							autofocus onclick={(e) => e.stopPropagation()} />
					{:else}
						<p class="text-xs truncate m-0 {page.id === notebook.currentPageId ? 'text-white/90' : 'text-white/40'}">{page.name}</p>
						<p class="text-[10px] text-white/25 mt-0.5 m-0">Page {i + 1}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
					<button class="w-5 h-5 flex items-center justify-center rounded text-[11px] text-white/25
					               hover:text-[#00f5ff] hover:bg-[#00f5ff]/10 transition-colors"
						onclick={(e) => { e.stopPropagation(); notebook.startEditing(page); }} title="Rename">✎</button>
					{#if notebook.pages.length > 1}
						<button class="w-5 h-5 flex items-center justify-center rounded text-[11px] text-white/25
						               hover:text-red-400 hover:bg-red-500/10 transition-colors"
							onclick={(e) => { e.stopPropagation(); notebook.deletePage(page.id); }} title="Delete">✕</button>
					{/if}
				</div>
			</div>
		{/each}
	</nav>
	<div class="p-3 border-t border-white/10">
		<button class="w-full py-2.5 rounded-lg border border-dashed border-white/10 bg-transparent
		               text-xs text-white/25 cursor-pointer hover:border-[#00f5ff]/30 hover:text-[#00f5ff]/70 transition-colors"
			onclick={notebook.addPage}>+ New page</button>
	</div>
</aside>
