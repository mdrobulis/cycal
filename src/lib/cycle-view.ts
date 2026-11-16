import { diffDays } from './date';
import type { CycleStats, DayKey } from './types';

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

function inRange(day: DayKey, range?: { from: DayKey; to: DayKey }): boolean {
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

export interface CycleBarSegment {
  from: number;
  to: number;
}

export interface CycleBar {
  length: number;
  period: CycleBarSegment;
  fertile?: CycleBarSegment;
  pms?: CycleBarSegment;
  ovulation?: number;
  today?: number;
  next: number;
}

/**
 * Percent positions for the thin current-cycle bar. Ranges are inclusive on
 * both ends, so the end day adds one day of width. Returns null when the cycle
 * cannot be drawn honestly (no exact next start, paused, irregular, late or
 * built from the default length).
 */
export function cycleBar(stats: CycleStats): CycleBar | null {
  if (!stats.lastStart || !stats.nextStart) return null;
  if (stats.paused || stats.irregular || stats.daysLate || stats.usingDefault) return null;

  const start = stats.lastStart;
  const length = diffDays(start, stats.nextStart);
  if (length < 10) return null;

  const clamp = (value: number): number => Math.min(100, Math.max(0, value));
  const at = (day: DayKey, inclusiveEnd = false): number =>
    clamp(((diffDays(start, day) + (inclusiveEnd ? 1 : 0)) / length) * 100);

  const periodLength = Math.min(
    stats.lastPeriod?.length ?? stats.periodLengthForPrediction,
    length,
  );
  const period = { from: 0, to: clamp((periodLength / length) * 100) };
  const fertile = stats.fertileRange
    ? { from: at(stats.fertileRange.from), to: at(stats.fertileRange.to, true) }
    : undefined;
  const pms = stats.pmsRange
    ? { from: at(stats.pmsRange.from), to: at(stats.pmsRange.to, true) }
    : undefined;
  const ovulation = stats.ovulation ? at(stats.ovulation) : undefined;
  const today = stats.cycleDay
    ? clamp(((stats.cycleDay - 0.5) / length) * 100)
    : undefined;

  return { length, period, fertile, pms, ovulation, today, next: 100 };
}
