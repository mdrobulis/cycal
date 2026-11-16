<script lang="ts">
  import { cycleBar, cyclePhase } from '../lib/cycle-view';
  import { formatDay, formatRange, relativeDays } from '../lib/date';
  import { COPY } from '../lib/strings';
  import type { CycleStats } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    stats,
    today,
    onHistory,
  }: { stats: CycleStats; today: string; onHistory: () => void } = $props();

  const phase = $derived(cyclePhase(stats, today));
  const bar = $derived(cycleBar(stats));

  const phaseLabel = $derived.by(() => {
    switch (phase) {
      case 'period':
        return COPY.dashboard.phase.period;
      case 'ovulation':
        return COPY.dashboard.phase.ovulation;
      case 'fertile':
        return COPY.dashboard.phase.fertile;
      case 'pms':
        return COPY.dashboard.phase.pms;
      case 'late':
        return COPY.dashboard.phase.late(stats.daysLate ?? 0);
      case 'luteal':
        return COPY.dashboard.phase.luteal;
      case 'paused':
        return COPY.dashboard.phase.paused;
      case 'irregular':
        return COPY.dashboard.phase.irregular;
      default:
        return COPY.dashboard.phase.none;
    }
  });

  const nextText = $derived.by(() => {
    if (stats.nextRange) return formatRange(stats.nextRange.from, stats.nextRange.to);
    if (stats.nextStart) return formatDay(stats.nextStart);
    return '—';
  });
  const nextApprox = $derived(Boolean(stats.nextRange || stats.usingDefault));

  const nextHint = $derived.by(() => {
    if (!stats.nextStart) return '';
    if (stats.daysLate) return COPY.dashboard.countdown.late(stats.daysLate);
    return relativeDays(stats.nextStart, today);
  });

  const fertileText = $derived(
    stats.fertileRange ? formatRange(stats.fertileRange.from, stats.fertileRange.to) : '—',
  );
  const ovulationText = $derived(stats.ovulation ? formatDay(stats.ovulation) : '—');
  const pmsText = $derived(
    stats.pmsRange ? formatRange(stats.pmsRange.from, stats.pmsRange.to) : '—',
  );
  const lastText = $derived.by(() => {
    if (!stats.lastPeriod) return '—';
    if (stats.lastPeriod.end) {
      return formatRange(stats.lastPeriod.start, stats.lastPeriod.end);
    }
    return `${formatDay(stats.lastPeriod.start)} · ${COPY.dashboard.subs.ongoing}`;
  });

  const showSafety = $derived(!stats.paused && Boolean(stats.nextStart || stats.nextRange));
</script>

<section class="dash" aria-label={COPY.dashboard.aria}>
  {#if stats.cycleCount === 0}
    <div class="empty">
      <h2>{COPY.dashboard.emptyTitle}</h2>
      <button class="secondary" onclick={onHistory}>{COPY.dashboard.historyCta}</button>
    </div>
  {:else}
    <header class="hero-row">
      <p class="day" aria-label={`Ciklo diena ${stats.cycleDay ?? '—'}`}>
        <span class="num">{stats.cycleDay ?? '—'}</span><span class="unit">d.</span>
      </p>
      <span class="phase {phase}">{phaseLabel}</span>
    </header>

    {#if bar}
      <div
        class="cycle-bar"
        role="img"
        aria-label={`${COPY.dashboard.cycleAria}: ${nextText}`}
      >
        <span
          class="seg period"
          style={`left:${bar.period.from}%;width:${bar.period.to - bar.period.from}%`}
        ></span>
        {#if bar.fertile}
          <span
            class="seg fertile"
            style={`left:${bar.fertile.from}%;width:${bar.fertile.to - bar.fertile.from}%`}
          ></span>
        {/if}
        {#if bar.pms}
          <span
            class="seg pms"
            style={`left:${bar.pms.from}%;width:${bar.pms.to - bar.pms.from}%`}
          ></span>
        {/if}
        {#if bar.ovulation !== undefined}
          <span class="mark ovulation" style={`left:${bar.ovulation}%`}></span>
        {/if}
        {#if bar.today !== undefined}
          <span class="mark today" style={`left:${bar.today}%`}></span>
        {/if}
        <span class="mark next"></span>
      </div>
    {/if}

    <dl class="rows">
      <div class="row next">
        <dt><Icon name="calendar" size={18} /><span>{COPY.dashboard.rows.next}</span></dt>
        <dd>
          <span class="date">
            {#if nextApprox}<span class="approx" aria-label={COPY.dashboard.approxAria}>~</span>{/if}{nextText}
          </span>
          {#if nextHint}<span class="countdown">{nextHint}</span>{/if}
        </dd>
      </div>

      <div class="row">
        <dt><Icon name="leaf" size={18} /><span>{COPY.dashboard.rows.fertile}</span></dt>
        <dd><span class="date">{fertileText}</span></dd>
      </div>

      <div class="row">
        <dt><Icon name="ovum" size={18} /><span>{COPY.dashboard.rows.ovulation}</span></dt>
        <dd><span class="date">{ovulationText}</span></dd>
      </div>

      <div class="row secondary-row">
        <dt><Icon name="moon" size={18} /><span>{COPY.dashboard.rows.pms}</span></dt>
        <dd><span class="date">{pmsText}</span></dd>
      </div>

      <div class="row secondary-row">
        <dt><Icon name="droplet" size={18} /><span>{COPY.dashboard.rows.last}</span></dt>
        <dd><span class="date">{lastText}</span></dd>
      </div>
    </dl>

    {#if showSafety}
      <p class="note">{COPY.dashboard.notes.estimate}</p>
    {/if}
  {/if}
</section>

<style>
  .dash {
    padding-top: 16px;
  }

  .hero-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .day {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin: 0;
  }

  .num {
    font-size: 52px;
    line-height: 0.95;
    font-weight: 600;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    color: var(--muted);
    font-size: 16px;
  }

  .phase {
    margin-bottom: 4px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .phase.period {
    background: var(--period-fill);
    color: var(--on-period);
  }

  .phase.fertile {
    background: var(--fertile-soft);
    color: var(--ink);
  }

  .phase.ovulation,
  .phase.pms {
    background: var(--accent-soft);
    color: var(--ink);
  }

  .phase.late {
    color: var(--danger);
    border: 1px solid var(--danger);
  }

  .phase.paused,
  .phase.irregular,
  .phase.luteal,
  .phase.none {
    background: var(--hover);
    color: var(--muted);
  }

  .cycle-bar {
    position: relative;
    height: 8px;
    margin: 16px 0 8px;
    border-radius: 999px;
    background: var(--line);
  }

  .seg {
    position: absolute;
    top: 0;
    height: 8px;
  }

  .seg.period {
    background: var(--period-fill);
    border-radius: 999px 0 0 999px;
  }

  .seg.fertile {
    background: var(--fertile-soft);
  }

  .seg.pms {
    background: var(--accent-soft);
  }

  .mark {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  .mark.ovulation {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .mark.today {
    width: 2px;
    height: 14px;
    background: var(--ink);
    z-index: 2;
  }

  .mark.next {
    left: 100%;
    width: 2px;
    height: 8px;
    background: var(--accent);
  }

  .rows {
    margin: 8px 0 0;
    padding: 0;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }

  .row:last-child {
    border-bottom: 0;
  }

  dt {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--ink);
    font-size: 14px;
  }

  dt :global(svg) {
    flex: 0 0 auto;
    color: var(--muted);
  }

  dd {
    margin: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    text-align: right;
  }

  .date {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .next .date {
    font-size: 18px;
    font-weight: 600;
  }

  .countdown {
    color: var(--muted);
    font-size: 12.5px;
  }

  .approx {
    margin-right: 2px;
    color: var(--muted);
  }

  .row.secondary-row dt,
  .row.secondary-row .date {
    color: var(--muted);
  }

  .row.secondary-row .date {
    font-size: 14px;
  }

  .note {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 12.5px;
    line-height: 1.4;
  }

  .empty {
    padding-top: 18px;
  }

  .empty h2 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 600;
  }

  .empty .secondary {
    min-width: 44px;
  }
</style>
