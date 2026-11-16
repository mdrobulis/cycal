import { addDays, diffDays, rangeDays } from './date';
import type { ActivePeriod, DayEvent, DayKey, PeriodBlock } from './types';

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
 * A period is a start plus every confirmed bleeding day, closed by an explicit
 * end. The end is the last bleeding day, so the block is start..end inclusive.
 */
export function periodBlocks(events: DayEvent[]): PeriodBlock[] {
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
    const active = !end && index === starts.length - 1;
    return {
      start,
      end,
      lastConfirmed,
      length: end ? diffDays(start, end) + 1 : undefined,
      active,
      hasConfirmations: blockDays.length > 0,
    };
  });
}

export function recordedPeriodDays(events: DayEvent[]): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const block of periodBlocks(events)) {
    for (const day of rangeDays(block.start, block.lastConfirmed)) days.add(day);
  }
  return days;
}

export function periodCoversDate(events: DayEvent[], date: DayKey): boolean {
  return periodBlocks(events).some(
    (block) => date >= block.start && date <= block.lastConfirmed,
  );
}

export function findActivePeriod(events: DayEvent[], today: DayKey): ActivePeriod | null {
  const blocks = periodBlocks(events).filter((block) => block.start <= today);
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
