import type { DayKey, DayRange } from './types';

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options });
}

export function formatDay(key: DayKey): string {
  return formatter({ day: 'numeric', month: 'short' }).format(new Date(dayKeyToUTC(key)));
}

export function formatDayYear(key: DayKey): string {
  return formatter({ day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(dayKeyToUTC(key)),
  );
}

export function formatLongDay(key: DayKey): string {
  return formatter({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(dayKeyToUTC(key)),
  );
}

export function formatRange(from: DayKey, to: DayKey): string {
  if (from === to) return formatDay(from);
  const [fy, fm] = from.split('-');
  const [ty, tm] = to.split('-');
  if (fy === ty && fm === tm) {
    return `${Number(from.slice(8, 10))}–${formatDay(to)}`;
  }
  if (fy === ty) return `${formatDay(from)} – ${formatDay(to)}`;
  return `${formatDayYear(from)} – ${formatDayYear(to)}`;
}

export function relativeDays(target: DayKey, today: DayKey): string {
  const d = diffDays(today, target);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1) return `in ${d} days`;
  return `${Math.abs(d)} days ago`;
}
