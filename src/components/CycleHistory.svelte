<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { formatDay, formatRange } from '../lib/date';
  import { COPY } from '../lib/strings';
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
  <button class="icon-btn" aria-label={COPY.common.back} onclick={onBack}>
    <Icon name="back" />
  </button>
  <h1 class="page-title">{COPY.history.title}</h1>
</header>

{#if history.length === 0}
  <p class="empty">{COPY.history.empty}</p>
{:else}
  <p class="summary">
    {#if average !== null}
      <strong>{COPY.history.average(average)}</strong>
      {#if low !== null && high !== null && low !== high}
        <span class="dot">·</span>
        {COPY.history.range(low, high)}
      {/if}
      <span class="dot">·</span>
      {COPY.history.count(lengths.length)}
    {:else}
      {COPY.history.needAverage}
    {/if}
  </p>

  <div class="list-head">
    <span>{COPY.history.columns.cycle}</span>
    <span>{COPY.history.columns.period}</span>
  </div>

  <div class="list">
    {#each history as cycle (cycle.start)}
      <div class="cycle">
        <div class="main">
          <p class="dates">
            {#if cycle.end}
              {formatRange(cycle.start, cycle.end)}
            {:else if cycle.current}
              {COPY.history.from(formatDay(cycle.start))} · {COPY.history.ongoing}
            {:else}
              {COPY.history.from(formatDay(cycle.start))} · {COPY.history.noEnd}
            {/if}
          </p>
          <p class="meta">
            {#if cycle.current}
              {COPY.history.current}
            {:else if cycle.cycleLength}
              {COPY.history.cycleLength(cycle.cycleLength)}
            {:else}
              —
            {/if}
          </p>
        </div>
        <p class="period">
          {cycle.periodLength
            ? COPY.history.periodLength(cycle.periodLength)
            : '—'}
        </p>
      </div>
    {/each}
  </div>

  <p class="note">{COPY.history.note}</p>
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
    font-size: 12px;
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
    font-size: 13px;
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
    font-size: 13px;
    line-height: 1.5;
  }
</style>
