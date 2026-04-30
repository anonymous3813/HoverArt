<script lang="ts">import './layout.css';
import { onDestroy, onMount } from 'svelte';
const { children } = $props();
onMount(() => {
    const cursor = document.getElementById('cursor');
    const dot = document.getElementById('cursorDot');
    let mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    function animCursor() {
        cx += (mx - cx) * 0.12;
        cy += (my - cy) * 0.12;
        cursor.style.left = cx + 'px';
        cursor.style.top = cy + 'px';
        dot.style.left = mx + 'px';
        dot.style.top = my + 'px';
        requestAnimationFrame(animCursor);
    }
    animCursor();
});
</script>

<svelte:head>
  <title>HoverArt — Draw Without Touching</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
</svelte:head>

<div class="cursor" id="cursor"></div>
<div class="cursor-dot" id="cursorDot"></div>

{@render children()}
