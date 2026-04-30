<<<<<<< HEAD:hover-art-frontend/src/routes/boxing/+page.svelte

<script>import BoxingGame from '$lib/components/BoxingGame.svelte';
=======
<!-- src/routes/boxing/+page.svelte -->
<script>
  import BoxingGame from './BoxingGame.svelte';
>>>>>>> 68aa9ff59fba30d9b0ec6d395e6fc1f0bb7b10b9:hover-art-frontend/src/routes/games/boxing/+page.svelte
</script>

<svelte:head>
  <title>Boxing 3D</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&display=swap"
    rel="stylesheet"
  />
</svelte:head>


<main class="w-full h-screen bg-[#0a0a0a]">
  <BoxingGame />
</main>