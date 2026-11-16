<script lang="ts">
  import { formatDay, formatRange, relativeDays } from '../lib/date';
  import { COPY } from '../lib/strings';
  import type { CycleStats } from '../lib/types';

  let { stats, today }: { stats: CycleStats; today: string } = $props();

  const fertileNow = $derived(
    stats.fertileRange
      ? today >= stats.fertileRange.from && today <= stats.fertileRange.to
      : false,
  );

  const status = $derived.by(() => {
    if (stats.paused) return COPY.dashboard.status.paused;
    if (stats.pendingBleeding && stats.lastStart) {
      return COPY.dashboard.status.periodStarted(relativeDays(stats.lastStart, today));
    }
    if (fertileNow) return COPY.dashboard.status.fertile;
    if (stats.daysLate === 1) return COPY.dashboard.status.lateOne;
    if (stats.daysLate) return COPY.dashboard.status.late(stats.daysLate);
    if (stats.nextStart) {
      return COPY.dashboard.status.next(relativeDays(stats.nextStart, today));
    }
    if (stats.nextRange) return COPY.dashboard.status.irregular;
    if (!stats.lastStart) return COPY.dashboard.status.empty;
    return COPY.dashboard.status.needAnother;
  });

  const nextRelative = $derived.by(() => {
    if (!stats.nextStart) return '';
    if (stats.daysLate) return COPY.dashboard.nextLate(stats.daysLate);
    return relativeDays(stats.nextStart, today);
  });

  const missingEstimate = $derived.by(() => {
    if (stats.paused) return COPY.dashboard.subs.changeMode;
    if (stats.irregular) return COPY.dashboard.subs.irregular;
    if (!stats.enoughData) return COPY.dashboard.subs.needCycle;
    return COPY.dashboard.subs.notEstimated;
  });
</script>

<section class="dash" aria-label={COPY.dashboard.aria}>
  <div class="hero-row">
    <div>
      <p class="eyebrow">{COPY.dashboard.eyebrow}</p>
      <p class="hero">{stats.cycleDay ?? '—'}</p>
    </div>
    <p class="status">{status}</p>
  </div>

  {#if stats.cycleCount === 0}
    <div class="empty">
      <h2>{COPY.dashboard.emptyTitle}</h2>
      <p>{COPY.dashboard.emptyBody}</p>
    </div>
  {:else}
    <dl class="grid">
      {#if stats.paused}
        <div class="cell wide">
          <dt>{COPY.dashboard.labels.predictions}</dt>
          <dd>
            <span class="value">{COPY.dashboard.pausedValue}</span>
            <span class="sub">{COPY.dashboard.pausedSub}</span>
          </dd>
        </div>
      {:else}
        <div class="cell wide">
          <dt>{COPY.dashboard.labels.next}</dt>
          <dd>
            {#if stats.nextRange}
              <span class="value">{formatRange(stats.nextRange.from, stats.nextRange.to)}</span>
              <span class="sub">{COPY.dashboard.subs.uncertain}</span>
            {:else if stats.nextStart}
              <span class="value">{formatDay(stats.nextStart)}</span>
              <span class="sub">{nextRelative}</span>
              {#if stats.usingDefault}
                <span class="sub">{COPY.dashboard.subs.defaultCycle}</span>
              {/if}
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>

        <div class="cell">
          <dt>{COPY.dashboard.labels.fertile}</dt>
          <dd>
            {#if stats.fertileRange}
              <span class="value">{formatRange(stats.fertileRange.from, stats.fertileRange.to)}</span>
              <span class="sub">{COPY.dashboard.subs.fiveBefore}</span>
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>

        <div class="cell">
          <dt>{COPY.dashboard.labels.ovulation}</dt>
          <dd>
            {#if stats.ovulation}
              <span class="value">{formatDay(stats.ovulation)}</span>
            {:else}
              <span class="value">—</span>
              <span class="sub">{missingEstimate}</span>
            {/if}
          </dd>
        </div>

        <div class="cell">
          <dt>{COPY.dashboard.labels.pms}</dt>
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

      <div class="cell">
        <dt>{COPY.dashboard.labels.last}</dt>
        <dd>
          {#if stats.lastPeriod}
            {#if stats.lastPeriod.end}
              <span class="value">
                {formatRange(stats.lastPeriod.start, stats.lastPeriod.end)}
              </span>
              {#if stats.lastPeriod.length}
                <span class="sub">{stats.lastPeriod.length} d.</span>
              {/if}
            {:else}
              <span class="value">{formatDay(stats.lastPeriod.start)} · {COPY.dashboard.subs.ongoing}</span>
              <span class="sub">{COPY.dashboard.subs.notEnded}</span>
            {/if}
          {:else}
            <span class="value">—</span>
          {/if}
        </dd>
      </div>
    </dl>

    {#if !stats.paused && (stats.nextStart || stats.nextRange)}
      <p class="note">{COPY.dashboard.notes.estimate}</p>
    {/if}
  {/if}
</section>

<style>
  .dash {
    padding-top: 10px;
  }

  .hero {
    margin-top: 2px;
  }

  .hero-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }

  .status {
    margin: 0 0 4px;
    max-width: 18ch;
    color: var(--muted);
    font-size: 16px;
    text-align: right;
  }

  .grid {
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
  }

  .cell {
    min-width: 0;
    padding-top: 6px;
    border-top: 1px solid var(--line);
  }

  .cell.wide {
    grid-column: 1 / -1;
  }

  dt {
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
  }

  dd {
    margin: 4px 0 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .value {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .sub {
    color: var(--muted);
    font-size: 12.5px;
    line-height: 1.35;
  }

  .note {
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
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
