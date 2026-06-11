<script lang="ts">
	import { TOOLS, TOOL_ICONS, TOOL_LABELS, type Tool } from '$lib/whiteboard/types.ts';

	export let activeTool: Tool = 'draw';
	export let hoveredTool: Tool | null = null;
	export let brushColor = '#00f5ff';
	export let brushSize = 4;
	export let presetColors = ['#ffffff', '#00f5ff', '#ff4ecd', '#ffdd57', '#4eff91', '#ff6b35', '#a78bfa', '#f87171'];
	export let onToolSelect: (tool: Tool) => void = () => {};
	export let onBrushColorChange: (color: string) => void = () => {};
	export let onBrushSizeChange: (size: number) => void = () => {};

	export let toolbarEl: HTMLDivElement | undefined;
</script>

<div
	bind:this={toolbarEl}
	class="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center
	       bg-[#0d0d1a]/95 backdrop-blur-md border border-white/10 rounded-2xl px-2 py-1.5 gap-1"
>
	{#each TOOLS as tool (tool)}
		<button
			class="relative flex flex-col items-center justify-center w-10 h-10 rounded-xl
			       text-base transition-all duration-100 cursor-pointer
			       {activeTool === tool
			         ? 'bg-[#00f5ff]/15 text-[#00f5ff] shadow-[0_0_12px_rgba(0,245,255,0.2)]'
			         : hoveredTool === tool
			           ? 'bg-white/10 text-white/80 scale-110'
			           : 'text-white/35 hover:bg-white/5 hover:text-white/60'}"
			onclick={() => onToolSelect(tool)}
			title={TOOL_LABELS[tool]}
		>
			{TOOL_ICONS[tool]}
			{#if activeTool === tool}
				<span class="absolute bottom-1 w-1 h-1 rounded-full bg-[#00f5ff]"></span>
			{/if}
			{#if hoveredTool === tool && activeTool !== tool}
				<span class="absolute inset-0 rounded-xl border border-white/30 pointer-events-none"></span>
			{/if}
		</button>
		{#if tool === 'select' || tool === 'arrow'}
			<div class="w-px h-6 bg-white/10 mx-0.5"></div>
		{/if}
	{/each}

	<div class="w-px h-6 bg-white/10 mx-1"></div>

	{#each presetColors as c (c)}
		<button
			class="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 cursor-pointer p-0
			       {brushColor === c ? 'swatch-active scale-110' : 'border-transparent'}"
			style:background={c}
			onclick={() => onBrushColorChange(c)}
			aria-label={c}
		></button>
	{/each}
	<label class="relative w-5 h-5 rounded-full border border-dashed border-white/25
	              flex items-center justify-center cursor-pointer shrink-0 ml-0.5"
		title="Custom colour">
		<span class="w-3 h-3 rounded-full block" style:background={brushColor}></span>
		<input type="color" class="absolute opacity-0 w-px h-px" value={brushColor} oninput={(e) => onBrushColorChange((e.currentTarget as HTMLInputElement).value)} />
	</label>

	<div class="w-px h-6 bg-white/10 mx-1"></div>

	<div class="flex items-center gap-1.5 px-1">
		<input
			type="range"
			min="1"
			max="40"
			step="1"
			value={brushSize}
			oninput={(e) => onBrushSizeChange(Number((e.currentTarget as HTMLInputElement).value))}
			class="brush-slider w-20"
		/>
		<span class="text-[10px] text-white/30 min-w-[22px] tabular-nums">{brushSize}px</span>
	</div>
</div>
