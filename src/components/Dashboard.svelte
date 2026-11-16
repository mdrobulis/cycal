<script lang="ts">
  import { formatDay, formatRange, relativeDays } from '../lib/date';
  import { ESTIMATE_NOTE, NO_CYCLES_BODY, NO_CYCLES_TITLE } from '../lib/strings';
  import type { CycleStats } from '../lib/types';

  let { stats, today }: { stats: CycleStats; today: string } = $props();

  const fertileNow = $derived(
    stats.fertileRange
      ? today >= stats.fertileRange.from && today <= stats.fertileRange.to
      : false,
  );

  const status = $derived.by(() => {
    if (stats.paused) return 'Predictions paused';
    if (stats.pendingBleeding && stats.lastStart) {
      return `Period started ${relativeDays(stats.lastStart, today)}`;
    }
    if (fertileNow) return 'Fertile window';
    if (stats.daysLate) {
      return stats.daysLate === 1
        ? 'Period expected yesterday'
        : `Period ${stats.daysLate} days late`;
    }
    if (stats.nextStart) return `Next period ${relativeDays(stats.nextStart, today)}`;
    if (stats.nextRange) return 'Cycle length varies';
    if (!stats.lastStart) return 'No cycle yet';
    return 'Add another cycle to estimate';
  });

  const nextRelative = $derived.by(() => {
    if (!stats.nextStart) return '';
    if (stats.daysLate) {
      return stats.daysLate === 1 ? 'expected yesterday' : `expected ${stats.daysLate} days ago`;
    }
    return relativeDays(stats.nextStart, today);
  });

  const missingEstimate = $derived.by(() => {
    if (stats.paused) return 'Predictions are paused in Settings';
    if (stats.irregular) return 'Not estimated for irregular cycles';
    if (!stats.enoughData) return 'Add another cycle to estimate';
    return 'Not estimated';
  });
</script>

<section class="dash" aria-label="Cycle overview">
  <p class="eyebrow">Cycle day</p>
  <p class="hero">{stats.cycleDay ?? '—'}</p>
  <p class="status">{status}</p>

  {#if stats.cycleCount === 0}
    <div class="empty">
      <h2>{NO_CYCLES_TITLE}</h2>
      <p>{NO_CYCLES_BODY}</p>
    </div>
  {:else}
    <dl class="stats">
      {#if stats.paused}
        <div class="stat">
          <dt>Predictions</dt>
          <dd>
            <span class="value">Paused</span>
            <span class="sub">Change the mode in Settings</span>
          </dd>
        </div>
      {:else}
        <div class="stat">
          <dt>Next period</dt>
          <dd>
            {#if stats.nextRange}
              <span class="value">{formatRange(stats.nextRange.from, stats.nextRange.to)}</span>
              <span class="sub">Uncertain range</span>
            {:else if stats.nextStart}
              <span class="value">{formatDay(stats.nextStart)} · {nextRelative}</span>
              {#if stats.usingDefault}
                <span class="sub">using your default cycle length</span>
              {/if}
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>

        <div class="stat">
          <dt>Fertile window</dt>
          <dd>
            {#if stats.fertileRange}
              <span class="value">{formatRange(stats.fertileRange.from, stats.fertileRange.to)}</span>
              <span class="sub">Five days before ovulation</span>
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>

        <div class="stat">
          <dt>Ovulation</dt>
          <dd>
            {#if stats.ovulation}
              <span class="value">{formatDay(stats.ovulation)}</span>
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>

        <div class="stat">
          <dt>PMS window</dt>
          <dd>
            {#if stats.pmsRange}
              <span class="value">{formatRange(stats.pmsRange.from, stats.pmsRange.to)}</span>
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>
      {/if}

      <div class="stat">
        <dt>Last period</dt>
        <dd>
          {#if stats.lastPeriod}
            {#if stats.lastPeriod.end}
              <span class="value">
                {formatRange(stats.lastPeriod.start, stats.lastPeriod.end)}
              </span>
              {#if stats.lastPeriod.length}
                <span class="sub">
                  {stats.lastPeriod.length}
                  {stats.lastPeriod.length === 1 ? 'day' : 'days'}
                </span>
              {/if}
            {:else}
              <span class="value">{formatDay(stats.lastPeriod.start)} · ongoing</span>
              <span class="sub">Not ended yet</span>
            {/if}
          {:else}
            <span class="value">—</span>
          {/if}
        </dd>
      </div>
    </dl>

    {#if stats.irregular && !stats.paused}
      <p class="note">
        Fertile, ovulation and PMS dates stay hidden while cycles are irregular.
      </p>
    {/if}

    {#if !stats.paused && (stats.nextStart || stats.nextRange)}
      <p class="note">{ESTIMATE_NOTE}</p>
    {/if}
  {/if}
</section>

<style>
  .dash {
    padding-top: 18px;
  }

  .hero {
    margin-top: 2px;
  }

  .status {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 15px;
  }

  .stats {
    margin: 24px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .stat {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 0;
    border-bottom: 1px solid var(--line);
  }

  .stat:last-child {
    border-bottom: 0;
  }

  dt {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 14px;
  }

  dd {
    margin: 0;
    min-width: 0;
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .value {
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .sub {
    color: var(--muted);
    font-size: 12px;
  }

  .note {
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .empty {
    margin-top: 26px;
  }

  .empty h2 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 600;
  }

  .empty p {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    max-width: 34ch;
  }
</style>
