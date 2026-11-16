import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  formatDay,
  formatRange,
  isDayKey,
  rangeDays,
  todayKey,
} from './date';

describe('isDayKey', () => {
  it('accepts real civil dates', () => {
    expect(isDayKey('2024-02-29')).toBe(true);
    expect(isDayKey('2026-11-16')).toBe(true);
    expect(isDayKey('2000-01-01')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    for (const value of [
      '2023-02-29',
      '2026-13-01',
      '2026-04-31',
      '2026-00-10',
      '2026-1-1',
      '16-11-2026',
      '',
      '2026-11-16T00:00:00Z',
    ]) {
      expect(isDayKey(value), value).toBe(false);
    }
  });
});

describe('addDays', () => {
  it('crosses leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is unaffected by daylight saving changes', () => {
    // Europe/Vilnius enters DST on 2026-03-29 and leaves on 2026-10-25.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('diffDays', () => {
  it('counts whole days in both directions', () => {
    expect(diffDays('2026-11-09', '2026-11-16')).toBe(7);
    expect(diffDays('2026-11-16', '2026-11-09')).toBe(-7);
    expect(diffDays('2024-02-28', '2024-03-01')).toBe(2);
  });

  it('is two days across a DST weekend', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('rangeDays', () => {
  it('is inclusive', () => {
    expect(rangeDays('2026-11-09', '2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
  });

  it('is empty when reversed', () => {
    expect(rangeDays('2026-11-11', '2026-11-09')).toEqual([]);
  });

  it('returns a single day', () => {
    expect(rangeDays('2026-11-09', '2026-11-09')).toEqual(['2026-11-09']);
  });
});

describe('formatting', () => {
  it('formats a day without a timezone shift', () => {
    expect(formatDay('2026-11-22')).toBe('22 Nov');
    expect(formatDay('2026-01-01')).toBe('1 Jan');
  });

  it('formats ranges within and across months', () => {
    expect(formatRange('2026-11-18', '2026-11-24')).toBe('18–24 Nov');
    expect(formatRange('2026-11-29', '2026-12-03')).toBe('29 Nov – 3 Dec');
    expect(formatRange('2026-11-18', '2026-11-18')).toBe('18 Nov');
  });

  it('uses the local civil date for today', () => {
    expect(todayKey(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(todayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
