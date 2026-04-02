<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import FaceBreakoutGame from '$lib/components/FaceBreakoutGame.svelte';
	import { isLoggedIn } from '$lib/auth.svelte.ts';

	onMount(() => {
		if (!isLoggedIn()) goto('/login');
	});
</script>

<svelte:head>
	<title>HoverArt — Face Breakout</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<a
	href="/"
	class="fixed top-3 left-3 z-[60] rounded-md border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-[#00f5ff]/90 backdrop-blur-sm hover:text-[#00f5ff]"
	style="font-family: 'Space Mono', monospace;"
>
	← Home
</a>

<FaceBreakoutGame />
