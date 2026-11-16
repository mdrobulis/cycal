<script lang="ts">
  import type { ActivePeriod } from '../lib/types';

  let {
    period,
    onStill,
    onEnded,
  }: {
    period: ActivePeriod;
    onStill: () => void;
    onEnded: () => void;
  } = $props();
</script>

<div class="active-period">
  <p class="label">
    {#if period.days > 10}
      Period still open — day {period.days}
    {:else}
      Day {period.days} of your period
    {/if}
  </p>
  <div class="actions">
    <button class="primary" onclick={onStill}>Still bleeding</button>
    <button class="secondary" onclick={onEnded}>Ended</button>
  </div>
</div>

<style>
  .label {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions .primary {
    flex: 1;
    width: auto;
  }

  .actions .secondary {
    flex: 0 0 auto;
  }
</style>
