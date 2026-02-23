<script lang="ts">
	import HandCanvas from '$lib/components/HandCanvas.svelte';

	let brushColor = $state('#00f5ff');
	let brushSize = $state(4);
	let handCanvas: HandCanvas | null = null;
	let currentGesture = $state('none');

	function handleGestureChange(g: string) {
		currentGesture = g;
	}

	const PRESET_COLORS = [
		'#ffffff',
		'#00f5ff',
		'#ff4ecd',
		'#ffdd57',
		'#4eff91',
		'#ff6b35',
		'#a78bfa',
		'#f87171'
	];
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

<main
	class="mx-auto flex max-w-[1100px] flex-col gap-5 px-5 pt-6 pb-12"
	style="font-family: 'Space Mono', monospace;"
>
	<!-- Header -->
	<header class="text-center">
		<h1
			class="m-0 text-4xl font-extrabold tracking-tight text-white md:text-6xl"
			style="font-family: 'Syne', sans-serif;"
		>
			Hover<span class="text-[#00f5ff]">Art</span>
		</h1>
		<p class="mt-1.5 text-xs tracking-widest text-white/30 uppercase">
			Draw with your hands. No touch required.
		</p>
	</header>

	<!-- Toolbar -->
	<div
		class="flex flex-wrap items-end gap-7 rounded-xl border border-white/10 bg-[#111118] px-5 py-4"
	>
		<!-- Color -->
		<div class="flex flex-col gap-2">
			<label for="color-picker" class="text-[0.65rem] tracking-widest text-white/25 uppercase"
				>Color</label
			>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each PRESET_COLORS as c}
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
				<!-- Custom color picker -->
				<input
					type="color"
					bind:value={brushColor}
					class="h-6 w-6 cursor-pointer overflow-hidden rounded-full border-none bg-transparent p-0"
					title="Custom color"
				/>
			</div>
		</div>

		<!-- Brush size -->
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

		<!-- Actions -->
		<div class="ml-auto flex flex-row items-end gap-2">
			<button
				class="cursor-pointer rounded-lg border border-red-500/20 bg-white/5 px-4 py-2 text-xs text-red-400 transition-colors duration-150 hover:border-red-500/70 hover:bg-red-500/15"
				style="font-family: 'Space Mono', monospace;"
				onclick={() => handCanvas?.clearCanvas()}
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
		</div>
	</div>

	<!-- Canvas -->
	<div class="overflow-hidden rounded-xl border border-white/10 shadow-[0_0_60px_#00f5ff0a]">
		<HandCanvas
			bind:this={handCanvas}
			bind:brushColor
			bind:brushSize
			onGestureChange={handleGestureChange}
		/>
	</div>

	<!-- Brush preview -->
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
