export type DayKey = string; // YYYY-MM-DD, a civil date with no time or zone

export type EventKind =
  | 'period-start'
  | 'period-day'
  | 'period-end'
  | 'symptom'
  | 'mood'
  | 'flow'
  | 'intimacy'
  | 'note'
  | 'custom';

export type Severity = 1 | 2 | 3;
export type FlowValue = 'light' | 'medium' | 'heavy';
export type PredictionMode = 'auto' | 'irregular' | 'paused';
export type View = 'home' | 'settings' | 'history';

export interface DayEvent {
  id: string;
  date: DayKey;
  kind: EventKind;
  label?: string;
  value?: number | string;
  severity?: Severity;
  note?: string;
  createdAt: string;
}

export type NewEvent = Omit<DayEvent, 'id' | 'createdAt'>;

export interface Settings {
  cycleLengthDefault: number;
  periodLengthDefault: number;
  predictionMode: PredictionMode;
  lastExportAt?: string;
  backupNudgeDismissedAt?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  cycleLengthDefault: 28,
  periodLengthDefault: 5,
  predictionMode: 'auto',
};

export interface DayRange {
  from: DayKey;
  to: DayKey;
}

export interface PeriodBlock {
  start: DayKey;
  end?: DayKey;
  lastConfirmed: DayKey;
  length?: number;
  active: boolean;
  hasConfirmations: boolean;
}

export interface ActivePeriod {
  start: DayKey;
  lastConfirmed: DayKey;
  days: number;
  hasConfirmations: boolean;
}

export interface HistoryCycle {
  start: DayKey;
  end?: DayKey;
  cycleLength?: number;
  periodLength?: number;
  current: boolean;
}

export interface CycleStats {
  mode: PredictionMode;
  paused: boolean;
  irregular: boolean;
  cycleCount: number;
  enoughData: boolean;
  lastStart?: DayKey;
  cycleDay?: number;
  pendingBleeding: boolean;
  nextStart?: DayKey;
  nextRange?: DayRange;
  usingDefault: boolean;
  predictedPeriodDays: Set<DayKey>;
  fertileRange?: DayRange;
  ovulation?: DayKey;
  pmsRange?: DayRange;
  daysLate?: number;
  medianCycleLength?: number;
  averageCycleLength?: number;
  minCycleLength?: number;
  maxCycleLength?: number;
  periodLengthForPrediction: number;
  lastPeriod?: PeriodBlock;
}

export interface ProjectedCycle {
  start: DayKey;
  periodDays: DayKey[];
  fertile?: DayRange;
  ovulation?: DayKey;
  pms?: DayRange;
}

export interface UndoState {
  event: DayEvent;
  message: string;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(input?: Partial<Settings> | null): Settings {
  const raw = input ?? {};
  const mode: PredictionMode =
    raw.predictionMode === 'irregular' || raw.predictionMode === 'paused'
      ? raw.predictionMode
      : 'auto';
  return {
    cycleLengthDefault: clampInt(raw.cycleLengthDefault, 21, 45, DEFAULT_SETTINGS.cycleLengthDefault),
    periodLengthDefault: clampInt(raw.periodLengthDefault, 2, 10, DEFAULT_SETTINGS.periodLengthDefault),
    predictionMode: mode,
    lastExportAt: typeof raw.lastExportAt === 'string' ? raw.lastExportAt : undefined,
    backupNudgeDismissedAt:
      typeof raw.backupNudgeDismissedAt === 'string' ? raw.backupNudgeDismissedAt : undefined,
  };
}
