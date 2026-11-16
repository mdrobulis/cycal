import { diffDays } from './date';
import type { CycleStats, DayKey, DayRange } from './types';

export type CyclePhase =
  | 'period'
  | 'ovulation'
  | 'fertile'
  | 'pms'
  | 'late'
  | 'luteal'
  | 'paused'
  | 'irregular'
  | 'none';

export type CountdownState = 'future' | 'today' | 'past' | 'late' | 'none';

export interface Countdown {
  state: CountdownState;
  days?: number;
}

function inRange(day: DayKey, range?: DayRange): boolean {
  return Boolean(range && day >= range.from && day <= range.to);
}

/** The one-word state shown next to the cycle day. */
export function cyclePhase(stats: CycleStats, today: DayKey): CyclePhase {
  if (stats.paused) return 'paused';
  const inPeriod =
    stats.pendingBleeding ||
    Boolean(
      stats.lastPeriod &&
        today >= stats.lastPeriod.start &&
        today <= stats.lastPeriod.lastConfirmed,
    );
  if (inPeriod) return 'period';
  if (stats.irregular) return 'irregular';
  if (stats.ovulation === today) return 'ovulation';
  if (inRange(today, stats.fertileRange)) return 'fertile';
  if (inRange(today, stats.pmsRange)) return 'pms';
  if (stats.nextStart && today > stats.nextStart) return 'late';
  if (stats.nextStart || stats.nextRange) return 'luteal';
  return 'none';
}

/** Days from today to one predicted day. */
export function dayCountdown(today: DayKey, target?: DayKey): Countdown {
  if (!target) return { state: 'none' };
  const days = diffDays(today, target);
  if (days > 0) return { state: 'future', days };
  if (days === 0) return { state: 'today' };
  return { state: 'past' };
}

/** Days from today to the start of a predicted range. */
export function rangeCountdown(today: DayKey, range?: DayRange): Countdown {
  if (!range) return { state: 'none' };
  const toStart = diffDays(today, range.from);
  const toEnd = diffDays(today, range.to);
  if (toStart > 0) return { state: 'future', days: toStart };
  if (toEnd < 0) return { state: 'past' };
  return { state: 'today' };
}

/**
 * Countdown to the next predicted period. A past next-start or a past range
 * window is reported as late, with the number of overdue days.
 */
export function nextPeriodCountdown(stats: CycleStats, today: DayKey): Countdown {
  if (stats.nextStart) {
    const countdown = dayCountdown(today, stats.nextStart);
    if (countdown.state === 'past') {
      return { state: 'late', days: diffDays(stats.nextStart, today) };
    }
    return countdown;
  }

  if (stats.nextRange) {
    const countdown = rangeCountdown(today, stats.nextRange);
    if (countdown.state === 'past') {
      return { state: 'late', days: diffDays(stats.nextRange.to, today) };
    }
    return countdown;
  }

  return { state: 'none' };
}
