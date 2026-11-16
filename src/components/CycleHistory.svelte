<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { formatDay, formatRange } from '../lib/date';
  import Icon from './Icon.svelte';

  let { onBack }: { onBack: () => void } = $props();

  const history = $derived(app.history);
  const lengths = $derived(
    history
      .map((cycle) => cycle.cycleLength)
      .filter((length): length is number => typeof length === 'number'),
  );
  const average = $derived(
    lengths.length
      ? Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length)
      : null,
  );
  const low = $derived(lengths.length ? Math.min(...lengths) : null);
  const high = $derived(lengths.length ? Math.max(...lengths) : null);
</script>

<header class="topbar page-head">
  <button class="icon-btn" aria-label="Back" onclick={onBack}>
    <Icon name="back" />
  </button>
  <h1 class="page-title">Cycle history</h1>
</header>

{#if history.length === 0}
  <p class="empty">No cycles yet. Add a period start and it will appear here.</p>
{:else}
  <p class="summary">
    {#if average !== null}
      <strong>{average} days</strong> average
      {#if low !== high}
        <span class="dot">·</span>
        {low}–{high} day range
      {/if}
      <span class="dot">·</span>
      {lengths.length} completed {lengths.length === 1 ? 'cycle' : 'cycles'}
    {:else}
      Add another period start to see an average.
    {/if}
  </p>

  <div class="list-head">
    <span>Cycle</span>
    <span>Period</span>
  </div>

  <div class="list">
    {#each history as cycle (cycle.start)}
      <div class="cycle">
        <div class="main">
          <p class="dates">
            {#if cycle.end}
              {formatRange(cycle.start, cycle.end)}
            {:else if cycle.current}
              From {formatDay(cycle.start)} · ongoing
            {:else}
              From {formatDay(cycle.start)} · no end
            {/if}
          </p>
          <p class="meta">
            {#if cycle.current}
              Current cycle
            {:else if cycle.cycleLength}
              {cycle.cycleLength} day cycle
            {:else}
              —
            {/if}
          </p>
        </div>
        <p class="period">
          {cycle.periodLength
            ? `${cycle.periodLength} ${cycle.periodLength === 1 ? 'day' : 'days'}`
            : '—'}
        </p>
      </div>
    {/each}
  </div>

  <p class="note">
    Cycle length is measured start to start. The current cycle has no length until the next
    period starts.
  </p>
{/if}

<style>
  .page-head {
    justify-content: flex-start;
    gap: 0;
  }

  .summary {
    margin: 14px 0 20px;
    color: var(--muted);
    font-size: 14px;
  }

  .summary strong {
    color: var(--ink);
    font-weight: 600;
  }

  .dot {
    padding: 0 2px;
  }

  .list-head {
    display: flex;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cycle {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }

  .dates {
    margin: 0;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .meta {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 12px;
  }

  .period {
    margin: 0;
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .empty {
    margin-top: 24px;
    color: var(--muted);
    font-size: 15px;
  }

  .note {
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
</style>
