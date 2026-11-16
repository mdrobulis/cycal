<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { COPY } from '../lib/strings';
</script>

{#if app.undo}
  <div class="toast" role="status" aria-live="polite">
    <span>{app.undo.message}</span>
    <button onclick={() => app.undoLast()}>{COPY.common.undo}</button>
  </div>
{/if}
