import type { DayKey, DayRange } from './types';

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS_GENITIVE = [
  'sausio',
  'vasario',
  'kovo',
  'balandžio',
  'gegužės',
  'birželio',
  'liepos',
  'rugpjūčio',
  'rugsėjo',
  'spalio',
  'lapkričio',
  'gruodžio',
] as const;

const MONTHS_SHORT = [
  'saus.',
  'vas.',
  'kov.',
  'bal.',
  'geg.',
  'birž.',
  'liep.',
  'rugp.',
  'rugs.',
  'spal.',
  'lapkr.',
  'gruod.',
] as const;

const WEEKDAYS = [
  'sekmadienis',
  'pirmadienis',
  'antradienis',
  'trečiadienis',
  'ketvirtadienis',
  'penktadienis',
  'šeštadienis',
] as const;

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function dayKeyToUTC(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): DayKey {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(now: Date = new Date()): DayKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(key: DayKey, days: number): DayKey {
  return fromUTC(dayKeyToUTC(key) + days * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((dayKeyToUTC(to) - dayKeyToUTC(from)) / DAY_MS);
}

export function rangeDays(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  if (diffDays(from, to) < 0) return out;
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function rangeSet(range?: DayRange): Set<DayKey> {
  return new Set(range ? rangeDays(range.from, range.to) : []);
}

function parts(key: DayKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m!, d!];
}

/** Short Lithuanian date: “lapkr. 16 d.” */
export function formatDay(key: DayKey): string {
  const [, m, d] = parts(key);
  return `${MONTHS_SHORT[m - 1]} ${d} d.`;
}

/** Date with year: “2026 m. lapkr. 16 d.” */
export function formatDayYear(key: DayKey): string {
  const [y, m, d] = parts(key);
  return `${y} m. ${MONTHS_SHORT[m - 1]} ${d} d.`;
}

/** Full date without weekday: “2026 m. lapkričio 16 d.” */
export function formatLongDay(key: DayKey): string {
  const [y, m, d] = parts(key);
  return `${y} m. ${MONTHS_GENITIVE[m - 1]} ${d} d.`;
}

/** Full Lithuanian weekday: “pirmadienis”. */
export function weekdayName(key: DayKey): string {
  return WEEKDAYS[new Date(dayKeyToUTC(key)).getUTCDay()]!;
}

export function formatRange(from: DayKey, to: DayKey): string {
  if (from === to) return formatDay(from);
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  if (fy === ty && fm === tm) return `${MONTHS_SHORT[fm - 1]} ${fd}–${td} d.`;
  if (fy === ty) return `${formatDay(from)} – ${formatDay(to)}`;
  return `${formatDayYear(from)} – ${formatDayYear(to)}`;
}

export function relativeDays(target: DayKey, today: DayKey): string {
  const d = diffDays(today, target);
  if (d === 0) return 'šiandien';
  if (d === 1) return 'rytoj';
  if (d === -1) return 'vakar';
  if (d > 1) return `po ${d} d.`;
  return `prieš ${Math.abs(d)} d.`;
}

/** Group a set of days into contiguous, inclusive ranges, optionally for one month. */
export function dayRanges(days: Iterable<DayKey>, prefix?: string): DayRange[] {
  const sorted = [...new Set(days)]
    .filter((day) => !prefix || day.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b));
  const ranges: DayRange[] = [];
  for (const day of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && diffDays(last.to, day) === 1) last.to = day;
    else ranges.push({ from: day, to: day });
  }
  return ranges;
}
