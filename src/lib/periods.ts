import { addDays, diffDays, isDayKey, rangeDays } from './date';
import type { ActivePeriod, DayEvent, DayKey, PeriodBlock } from './types';

/** A start-only period older than this is treated as incomplete, not active. */
export const MAX_OPEN_PERIOD_DAYS = 10;

function uniqueSorted(dates: DayKey[]): DayKey[] {
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b));
}

export function periodStarts(events: DayEvent[], today?: DayKey): DayKey[] {
  const starts = uniqueSorted(
    events.filter((event) => event.kind === 'period-start').map((event) => event.date),
  );
  return today ? starts.filter((start) => start <= today) : starts;
}

export function periodEnds(events: DayEvent[]): DayKey[] {
  return uniqueSorted(
    events.filter((event) => event.kind === 'period-end').map((event) => event.date),
  );
}

export function confirmedPeriodDays(events: DayEvent[]): DayKey[] {
  return uniqueSorted(
    events.filter((event) => event.kind === 'period-day').map((event) => event.date),
  );
}

/**
 * One period record: a start, an optional explicit end, the last confirmed
 * bleeding day, and whether the open record is still current. The block is the
 * single source of truth used by the calendar, day panel and history.
 */
export function periodBlocks(events: DayEvent[], today: DayKey): PeriodBlock[] {
  const starts = periodStarts(events);
  const ends = periodEnds(events);
  const days = confirmedPeriodDays(events);

  return starts.map((start, index) => {
    const next = starts[index + 1];
    const blockEnds = ends.filter((end) => end >= start && (!next || end < next));
    const end = blockEnds.length ? blockEnds[blockEnds.length - 1]! : undefined;
    const blockDays = days.filter(
      (day) => day >= start && (!next || day < next) && (!end || day <= end),
    );
    const lastConfirmed = end ?? (blockDays.length ? blockDays[blockDays.length - 1]! : start);
    const open = !end;
    const latest = index === starts.length - 1;
    const age = diffDays(start, today);
    const fresh = open && latest && start <= today && age <= MAX_OPEN_PERIOD_DAYS;
    const active = fresh;
    const stale = open && latest && start <= today && age > MAX_OPEN_PERIOD_DAYS;
    const displayEnd = end ?? lastConfirmed;
    return {
      start,
      end,
      lastConfirmed,
      length: end ? diffDays(start, end) + 1 : undefined,
      open,
      active,
      stale,
      displayEnd,
      hasConfirmations: blockDays.length > 0,
    };
  });
}

/**
 * Days that are visibly part of a period: start..end when closed, otherwise
 * only the start and explicitly confirmed days. An open period is never painted
 * speculatively through today.
 */
export function periodDisplayDays(events: DayEvent[], today: DayKey): Set<DayKey> {
  const result = new Set<DayKey>();
  const confirmed = new Set(confirmedPeriodDays(events));
  for (const block of periodBlocks(events, today)) {
    if (block.end) {
      for (const day of rangeDays(block.start, block.end)) result.add(day);
    } else {
      result.add(block.start);
      for (const day of confirmed) {
        if (day >= block.start && day <= block.lastConfirmed) result.add(day);
      }
    }
  }
  return result;
}

/** Backwards-compatible name for the visible period day set. */
export function recordedPeriodDays(events: DayEvent[], today: DayKey): Set<DayKey> {
  return periodDisplayDays(events, today);
}

export function periodCoversDate(events: DayEvent[], date: DayKey, today: DayKey): boolean {
  return periodDisplayDays(events, today).has(date);
}

export function findActivePeriod(events: DayEvent[], today: DayKey): ActivePeriod | null {
  const blocks = periodBlocks(events, today).filter((block) => block.start <= today);
  const last = blocks[blocks.length - 1];
  if (!last || !last.active) return null;
  return {
    start: last.start,
    lastConfirmed: last.lastConfirmed,
    days: diffDays(last.start, today) + 1,
    hasConfirmations: last.hasConfirmations,
  };
}

/**
 * The sensible end date when the user says "it ended today": the last
 * confirmed day if there is one, otherwise yesterday (or the start day).
 */
export function endDateForActive(events: DayEvent[], today: DayKey): DayKey | null {
  const active = findActivePeriod(events, today);
  if (!active) return null;
  if (active.hasConfirmations) return active.lastConfirmed;
  return active.start < today ? addDays(today, -1) : active.start;
}

export type PeriodRangeIssue =
  | 'invalid'
  | 'future'
  | 'endFuture'
  | 'backwards'
  | 'overlap'
  | 'afterNext'
  | 'order'
  | 'openActive'
  | 'openNotLatest'
  | null;

/**
 * Validate a start/end range against the existing period blocks. `end = null`
 * means an open period and is only valid for the latest cycle.
 */
export function periodRangeIssue(
  events: DayEvent[],
  start: DayKey,
  end: DayKey | null,
  today: DayKey,
  ignoreStart?: DayKey,
): PeriodRangeIssue {
  if (!isDayKey(start) || (end !== null && !isDayKey(end))) return 'invalid';
  if (start > today) return 'future';
  if (end !== null && end > today) return 'endFuture';
  if (end !== null && end < start) return 'backwards';

  const rangeEnd = end ?? start;
  const blocks = periodBlocks(events, today).filter((block) => block.start !== ignoreStart);
  const openBlock = blocks.find((block) => block.active);
  if (openBlock && start > openBlock.start) return 'openActive';
  for (const block of blocks) {
    if (start <= block.lastConfirmed && rangeEnd >= block.start) return 'overlap';
  }

  const starts = periodStarts(events);
  const nextStart = ignoreStart
    ? starts.find((candidate) => candidate > ignoreStart)
    : starts.find((candidate) => candidate > start);
  if (nextStart) {
    if (start >= nextStart) return 'order';
    if (end === null) return 'openNotLatest';
    if (end >= nextStart) return 'afterNext';
  }
  return null;
}
