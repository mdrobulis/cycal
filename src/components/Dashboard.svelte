<script lang="ts">
  import {
    cyclePhase,
    dayCountdown,
    nextPeriodCountdown,
    rangeCountdown,
    type Countdown,
  } from '../lib/cycle-view';
  import { formatDay, formatRange } from '../lib/date';
  import { COPY } from '../lib/strings';
  import type { CycleStats } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    stats,
    today,
    onHistory,
  }: { stats: CycleStats; today: string; onHistory: () => void } = $props();

  const phase = $derived(cyclePhase(stats, today));
  const next = $derived(nextPeriodCountdown(stats, today));
  const fertile = $derived(rangeCountdown(today, stats.fertileRange));
  const ovulation = $derived(dayCountdown(today, stats.ovulation));
  const pms = $derived(rangeCountdown(today, stats.pmsRange));

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
        return COPY.dashboard.phase.lateShort;
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

  const nextDate = $derived.by(() => {
    if (stats.nextRange) return formatRange(stats.nextRange.from, stats.nextRange.to);
    if (stats.nextStart) return formatDay(stats.nextStart);
    return '—';
  });
  const fertileDate = $derived(
    stats.fertileRange ? formatRange(stats.fertileRange.from, stats.fertileRange.to) : '—',
  );
  const ovulationDate = $derived(stats.ovulation ? formatDay(stats.ovulation) : '—');
  const pmsDate = $derived(
    stats.pmsRange ? formatRange(stats.pmsRange.from, stats.pmsRange.to) : '—',
  );
  const lastText = $derived.by(() => {
    if (!stats.lastPeriod) return '—';
    if (stats.lastPeriod.end) {
      return formatRange(stats.lastPeriod.start, stats.lastPeriod.end);
    }
    return `${formatDay(stats.lastPeriod.start)} · ${COPY.dashboard.subs.ongoing}`;
  });

  const nextApprox = $derived(Boolean(stats.nextRange || stats.usingDefault));
  const phaseApprox = $derived(Boolean(stats.usingDefault));
  const showSafety = $derived(!stats.paused && Boolean(stats.nextStart || stats.nextRange));

  function valueText(countdown: Countdown): string {
    if (
      (countdown.state === 'future' || countdown.state === 'late') &&
      countdown.days !== undefined
    ) {
      return String(countdown.days);
    }
    if (countdown.state === 'today') return COPY.dashboard.countdown.now;
    return '—';
  }

  function hasUnit(countdown: Countdown): boolean {
    return countdown.state === 'future' || countdown.state === 'late';
  }
</script>

<section class="dash" aria-label={COPY.dashboard.aria}>
  {#if stats.cycleCount === 0}
    <div class="empty">
      <h2>{COPY.dashboard.emptyTitle}</h2>
      <button class="secondary" onclick={onHistory}>{COPY.dashboard.historyCta}</button>
    </div>
  {:else}
    <header class="context">
      <div>
        <p class="eyebrow">{COPY.dashboard.eyebrow}</p>
        <p class="day" aria-label={`Ciklo diena ${stats.cycleDay ?? '—'}`}>
          <span class="num">{stats.cycleDay ?? '—'}</span><span class="unit">d.</span>
        </p>
      </div>
      <span class="phase {phase}">{phaseLabel}</span>
    </header>

    <div class="counts">
      <article class="count">
        <p class="count-label">
          <Icon name="calendar" size={16} />
          <span>{COPY.dashboard.rows.next}</span>
        </p>
        <p class="count-value {next.state}">
          {valueText(next)}
          {#if hasUnit(next)}<span class="count-unit">d.</span>{/if}
        </p>
        <p class="count-date">
          {#if nextApprox}<span class="approx" aria-label={COPY.dashboard.approxAria}>~</span>{/if}{nextDate}
        </p>
        {#if next.state === 'late'}
          <p class="late-note">{COPY.dashboard.countdown.lateNote}</p>
        {/if}
      </article>

      <article class="count">
        <p class="count-label">
          <Icon name="leaf" size={16} />
          <span>{COPY.dashboard.rows.fertile}</span>
        </p>
        <p class="count-value {fertile.state}">
          {valueText(fertile)}
          {#if hasUnit(fertile)}<span class="count-unit">d.</span>{/if}
        </p>
        <p class="count-date">
          {#if phaseApprox}<span class="approx" aria-label={COPY.dashboard.approxAria}>~</span>{/if}{fertileDate}
        </p>
      </article>

      <article class="count">
        <p class="count-label">
          <Icon name="ovum" size={16} />
          <span>{COPY.dashboard.rows.ovulation}</span>
        </p>
        <p class="count-value {ovulation.state}">
          {valueText(ovulation)}
          {#if hasUnit(ovulation)}<span class="count-unit">d.</span>{/if}
        </p>
        <p class="count-date">
          {#if phaseApprox}<span class="approx" aria-label={COPY.dashboard.approxAria}>~</span>{/if}{ovulationDate}
        </p>
      </article>

      <article class="count">
        <p class="count-label">
          <Icon name="moon" size={16} />
          <span>{COPY.dashboard.rows.pms}</span>
        </p>
        <p class="count-value {pms.state}">
          {valueText(pms)}
          {#if hasUnit(pms)}<span class="count-unit">d.</span>{/if}
        </p>
        <p class="count-date">
          {#if phaseApprox}<span class="approx" aria-label={COPY.dashboard.approxAria}>~</span>{/if}{pmsDate}
        </p>
      </article>
    </div>

    <p class="last">{COPY.dashboard.rows.last}: {lastText}</p>

    {#if showSafety}
      <p class="note">{COPY.dashboard.notes.estimate}</p>
    {/if}
  {/if}
</section>

<style>
  .dash {
    padding-top: 16px;
  }

  .context {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 12px;
  }

  .eyebrow {
    margin-bottom: 2px;
  }

  .day {
    display: flex;
    align-items: baseline;
    gap: 3px;
    margin: 0;
  }

  .num {
    font-size: 30px;
    line-height: 1;
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    color: var(--muted);
    font-size: 13px;
  }

  .phase {
    margin-bottom: 3px;
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

  .counts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 18px;
    margin-top: 16px;
  }

  .count {
    min-width: 0;
    padding: 10px 0 12px;
    border-top: 1px solid var(--line);
  }

  .count-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 500;
  }

  .count-label :global(svg) {
    flex: 0 0 auto;
    color: var(--muted);
  }

  .count-value {
    display: flex;
    align-items: baseline;
    gap: 3px;
    margin: 5px 0 0;
    color: var(--ink);
    font-size: 44px;
    line-height: 1;
    font-weight: 600;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .count-value.today {
    font-size: 22px;
    letter-spacing: 0;
  }

  .count-value.past,
  .count-value.none {
    color: var(--muted);
    font-size: 30px;
  }

  .count-value.late {
    color: var(--danger);
  }

  .count-unit {
    color: var(--muted);
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0;
  }

  .count-date {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .approx {
    margin-right: 2px;
  }

  .late-note {
    margin: 2px 0 0;
    color: var(--danger);
    font-size: 11px;
  }

  .last {
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .note {
    margin: 10px 0 0;
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
