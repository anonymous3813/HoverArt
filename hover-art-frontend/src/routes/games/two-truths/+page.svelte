<<<<<<< HEAD:hover-art-frontend/src/routes/games/imposter/+page.svelte
<script lang="ts">import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import TwoTruthsLieGame from '$lib/components/TwoTruthsLieGame.svelte';
import { isLoggedIn } from '$lib/auth.svelte.ts';
onMount(() => {
    if (!isLoggedIn())
        goto('/login');
});
=======
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TwoTruthsLieGame from './TwoTruthsLieGame.svelte';
	import { isLoggedIn } from '$lib/auth.svelte.ts';

	onMount(() => {
		//if (!isLoggedIn()) goto('/login');
	});
>>>>>>> 68aa9ff59fba30d9b0ec6d395e6fc1f0bb7b10b9:hover-art-frontend/src/routes/games/two-truths/+page.svelte
</script>

<svelte:head>
	<title>HoverArt — Two Truths & a Lie</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="box-border flex min-h-dvh w-full flex-col items-center justify-center p-[1in] text-white"
	style="font-family: 'Space Mono', monospace;"
>
	<main class="flex w-full max-w-none flex-col items-center text-center">
		<a href="/" class="mb-5 text-xs text-[#00f5ff]/80 hover:text-[#00f5ff]">← Home</a>

		<h1 class="mb-2 text-3xl font-extrabold text-white" style="font-family: 'Syne', sans-serif;">
			Two Truths <span class="text-[#00f5ff]">& a Lie</span>
		</h1>
		<p class="mb-8 max-w-lg text-xs text-white/40">
			Three recordings → face heuristics, voice/pause heuristics, then OpenAI on the text. Backend must
			run with OPENAI_SECRET set.
		</p>

		<div class="flex w-full justify-center">
			<TwoTruthsLieGame />
		</div>
	</main>
</div>
