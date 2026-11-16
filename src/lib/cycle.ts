import { addDays, diffDays, rangeDays } from './date';
import { findActivePeriod, periodBlocks, periodStarts } from './periods';
import type {
  CycleStats,
  DayEvent,
  DayKey,
  HistoryCycle,
  PeriodBlock,
  ProjectedCycle,
  Settings,
} from './types';

function mean(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function rangeOf(values: number[]): { min: number; max: number } | undefined {
  if (!values.length) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function cycleLengths(starts: DayKey[]): number[] {
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    lengths.push(diffDays(starts[i - 1]!, starts[i]!));
  }
  return lengths;
}

export function computeStats(
  events: DayEvent[],
  settings: Settings,
  today: DayKey,
): CycleStats {
  const starts = periodStarts(events, today);
  const blocks = periodBlocks(events).filter((block) => block.start <= today);
  const lastStart = starts[starts.length - 1];
  const lastPeriod = blocks[blocks.length - 1];
  const active = findActivePeriod(events, today);

  const lengths = cycleLengths(starts);
  const recent = lengths.slice(-6);
  const spread = rangeOf(recent);
  const spreadDays = spread ? spread.max - spread.min : 0;

  const mode = settings.predictionMode;
  const paused = mode === 'paused';
  const irregular =
    !paused && (mode === 'irregular' || (mode === 'auto' && recent.length >= 2 && spreadDays > 4));

  let nextStart: DayKey | undefined;
  let nextRange: { from: DayKey; to: DayKey } | undefined;
  let usingDefault = false;

  if (!paused && lastStart) {
    if (mode === 'irregular') {
      if (recent.length >= 2 && spread) {
        nextRange = {
          from: addDays(lastStart, spread.min),
          to: addDays(lastStart, spread.max),
        };
      }
    } else if (recent.length === 0) {
      nextStart = addDays(lastStart, settings.cycleLengthDefault);
      usingDefault = true;
    } else if (irregular && spread) {
      nextRange = {
        from: addDays(lastStart, spread.min),
        to: addDays(lastStart, spread.max),
      };
    } else {
      nextStart = addDays(lastStart, median(recent)!);
    }
  }

  const periodLengths = blocks
    .map((block) => block.length)
    .filter((length): length is number => typeof length === 'number')
    .slice(-6);
  const medianPeriodLength = median(periodLengths);
  const periodLengthForPrediction = Math.round(
    medianPeriodLength ?? settings.periodLengthDefault,
  );

  const predictedPeriodDays = new Set<DayKey>();
  if (!paused) {
    if (nextStart) {
      for (let i = 0; i < periodLengthForPrediction; i += 1) {
        predictedPeriodDays.add(addDays(nextStart, i));
      }
    } else if (nextRange) {
      for (const day of rangeDays(nextRange.from, nextRange.to)) predictedPeriodDays.add(day);
    }
  }

  const estimate = nextStart
    ? {
        ovulation: addDays(nextStart, -14),
        fertile: { from: addDays(nextStart, -19), to: addDays(nextStart, -13) },
        pms: { from: addDays(nextStart, -5), to: addDays(nextStart, -1) },
      }
    : undefined;

  const daysLate =
    nextStart && diffDays(nextStart, today) > 0 ? diffDays(nextStart, today) : undefined;

  return {
    mode,
    paused,
    irregular,
    cycleCount: starts.length,
    enoughData: lengths.length >= 1,
    lastStart,
    cycleDay: lastStart ? diffDays(lastStart, today) + 1 : undefined,
    pendingBleeding: Boolean(active),
    nextStart,
    nextRange,
    usingDefault,
    predictedPeriodDays,
    fertileRange: estimate?.fertile,
    ovulation: estimate?.ovulation,
    pmsRange: estimate?.pms,
    daysLate,
    medianCycleLength: median(recent),
    averageCycleLength: mean(lengths),
    minCycleLength: rangeOf(lengths)?.min,
    maxCycleLength: rangeOf(lengths)?.max,
    periodLengthForPrediction,
    lastPeriod,
  };
}

export function computeHistory(
  events: DayEvent[],
  today: DayKey,
  limit = 12,
): HistoryCycle[] {
  const starts = periodStarts(events, today);
  const blocks = periodBlocks(events);
  return starts.slice(-limit).map((start, index, list) => {
    const next = list[index + 1];
    const block: PeriodBlock | undefined = blocks.find((candidate) => candidate.start === start);
    return {
      start,
      end: block?.end,
      cycleLength: next ? diffDays(start, next) : undefined,
      periodLength: block?.length,
      current: !next,
    };
  });
}

export function canProject(stats: CycleStats): boolean {
  return stats.mode !== 'paused' && !stats.irregular && Boolean(stats.lastStart);
}

export function projectCycles(
  stats: CycleStats,
  settings: Settings,
  count = 3,
): ProjectedCycle[] {
  if (!canProject(stats) || !stats.lastStart) return [];
  const length = Math.round(stats.medianCycleLength ?? settings.cycleLengthDefault);
  const periodLength = stats.periodLengthForPrediction;

  return Array.from({ length: count }, (_, index) => {
    const start = addDays(stats.lastStart!, length * (index + 1));
    const periodDays = rangeDays(start, addDays(start, periodLength - 1));
    const ovulation = addDays(start, -14);
    return {
      start,
      periodDays,
      ovulation,
      fertile: { from: addDays(ovulation, -5), to: addDays(ovulation, 1) },
      pms: { from: addDays(start, -5), to: addDays(start, -1) },
    };
  });
}
