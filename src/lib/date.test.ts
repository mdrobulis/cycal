import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayRanges,
  diffDays,
  formatDay,
  formatDayYear,
  formatLongDay,
  formatRange,
  isDayKey,
  rangeDays,
  relativeDays,
  todayKey,
  weekdayName,
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
    expect(formatDay('2026-11-22')).toBe('lapkr. 22 d.');
    expect(formatDay('2026-01-01')).toBe('saus. 1 d.');
    expect(formatDayYear('2026-11-22')).toBe('2026 m. lapkr. 22 d.');
  });

  it('formats ranges within and across months', () => {
    expect(formatRange('2026-11-18', '2026-11-24')).toBe('lapkr. 18–24 d.');
    expect(formatRange('2026-11-29', '2026-12-03')).toBe('lapkr. 29 d. – gruod. 3 d.');
    expect(formatRange('2026-11-18', '2026-11-18')).toBe('lapkr. 18 d.');
  });

  it('formats a full date and weekday', () => {
    expect(formatLongDay('2026-11-16')).toBe('2026 m. lapkričio 16 d.');
    expect(weekdayName('2026-11-16')).toBe('pirmadienis');
    expect(weekdayName('2026-11-22')).toBe('sekmadienis');
  });

  it('formats relative days', () => {
    expect(relativeDays('2026-11-16', '2026-11-16')).toBe('šiandien');
    expect(relativeDays('2026-11-17', '2026-11-16')).toBe('rytoj');
    expect(relativeDays('2026-11-15', '2026-11-16')).toBe('vakar');
    expect(relativeDays('2026-12-01', '2026-11-16')).toBe('po 15 d.');
    expect(relativeDays('2026-11-13', '2026-11-16')).toBe('prieš 3 d.');
  });

  it('uses the local civil date for today', () => {
    expect(todayKey(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(todayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('dayRanges', () => {
  it('compresses contiguous days and keeps gaps', () => {
    expect(
      dayRanges(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-07']),
    ).toEqual([
      { from: '2026-11-02', to: '2026-11-04' },
      { from: '2026-11-07', to: '2026-11-07' },
    ]);
  });

  it('filters to a month, including ranges that cross its edge', () => {
    expect(dayRanges(['2026-10-30', '2026-10-31', '2026-11-01'], '2026-11')).toEqual([
      { from: '2026-11-01', to: '2026-11-01' },
    ]);
  });

  it('handles an empty set', () => {
    expect(dayRanges([])).toEqual([]);
  });
});
