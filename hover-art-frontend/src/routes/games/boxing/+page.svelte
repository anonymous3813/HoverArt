<!-- src/routes/boxing/+page.svelte -->
<script>
  import BoxingGame from './BoxingGame.svelte';
</script>

<svelte:head>
  <title>Boxing 3D</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<!--
  The wrapper must have a defined height for the canvas to fill.
  h-screen fills the full viewport; subtract your nav height if needed
  e.g. h-[calc(100vh-4rem)]
-->
<main class="w-full h-screen bg-[#0a0a0a]">
  <BoxingGame />
</main>