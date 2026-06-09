<script>
	let { fps, frameTimeMs, handInferenceMs, faceInferenceMs, handsDetected } = $props();
</script>

<div
	class="pointer-events-none absolute top-20 right-3 z-[100]
         rounded-xl border border-white/10
         bg-[#0d0d1a]/95
         px-3.5
         py-2.5
         text-xs text-cyan-300
         shadow-lg backdrop-blur-md
		"
>
	<div class="mb-1 font-bold text-cyan-200">Performance</div>

	<div>FPS: {fps}</div>
	<div>Frame: {frameTimeMs.toFixed(1) ?? 0}ms</div>
	<div>Hand: {handInferenceMs.toFixed(1) ?? 0}ms</div>
	<div>Face: {faceInferenceMs.toFixed(1) ?? 0}ms</div>
	<div>Hands: {handsDetected}</div>
</div>
