<script lang="ts">
	export let phase:
		| 'idle'
		| 'drawing'
		| 'panning'
		| 'two-finger'
		| 'shaping'
		| 'erasing'
		| 'tool-select'
		| 'color-select'
		| 'size-select'
		| 'zooming' = 'idle';
	export let activeTool = 'draw';
</script>

<div class="fixed bottom-6 right-5 z-20 flex flex-col gap-1 px-3 py-2 min-w-[130px]
            bg-[#0d0d1a]/90 backdrop-blur-md border border-white/10 rounded-xl">
	<span class="text-[8px] tracking-[0.12em] text-white/20">STATE</span>
	<div class="flex items-center gap-1.5 text-[11px]
	            {phase !== 'idle' ? 'text-[#00f5ff]/80' : 'text-white/25'}">
		<span class="w-1.5 h-1.5 rounded-full shrink-0 {phase !== 'idle' ? 'bg-[#00f5ff]' : 'bg-white/10'}"></span>
		{phase}
	</div>
	<div class="text-[10px] text-white/20">tool: <span class="text-white/40">{activeTool}</span></div>
</div>
