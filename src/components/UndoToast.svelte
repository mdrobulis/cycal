<script lang="ts">
  import { app } from '../lib/store.svelte';
</script>

{#if app.undo}
  <div class="toast" role="status" aria-live="polite">
    <span>{app.undo.message}</span>
    <button onclick={() => app.undoLast()}>Undo</button>
  </div>
{/if}
