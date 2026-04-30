<script lang="ts">
  import BoxingScene from './BoxingGame.svelte';
</script>

<div class="boxing-scene-container">
  <BoxingScene />
</div>

<style>
  .boxing-scene-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
  }
</style>
