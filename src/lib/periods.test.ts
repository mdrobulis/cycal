import { describe, expect, it } from 'vitest';
import {
  endDateForActive,
  findActivePeriod,
  periodBlocks,
  periodRangeIssue,
  recordedPeriodDays,
} from './periods';
import { event } from './test-utils';

describe('periodBlocks', () => {
  it('treats a start without an end as active', () => {
    const [block] = periodBlocks([event('period-start', '2026-11-09')]);
    expect(block).toMatchObject({
      start: '2026-11-09',
      lastConfirmed: '2026-11-09',
      active: true,
      hasConfirmations: false,
    });
    expect(block?.end).toBeUndefined();
    expect(block?.length).toBeUndefined();
  });

  it('extends through confirmed bleeding days', () => {
    const [block] = periodBlocks([
      event('period-start', '2026-11-09'),
      event('period-day', '2026-11-10'),
      event('period-day', '2026-11-11'),
    ]);
    expect(block?.lastConfirmed).toBe('2026-11-11');
    expect(block?.active).toBe(true);
    expect(block?.hasConfirmations).toBe(true);
  });

  it('closes at an explicit end and measures the length', () => {
    const [block] = periodBlocks([
      event('period-start', '2026-11-09'),
      event('period-day', '2026-11-10'),
      event('period-end', '2026-11-13'),
    ]);
    expect(block?.end).toBe('2026-11-13');
    expect(block?.length).toBe(5);
    expect(block?.active).toBe(false);
  });

  it('ignores an end before the start', () => {
    const [block] = periodBlocks([
      event('period-start', '2026-11-09'),
      event('period-end', '2026-11-07'),
    ]);
    expect(block?.end).toBeUndefined();
    expect(block?.active).toBe(true);
  });

  it('keeps two periods separate', () => {
    const blocks = periodBlocks([
      event('period-start', '2026-10-01'),
      event('period-end', '2026-10-05'),
      event('period-start', '2026-10-29'),
      event('period-day', '2026-10-30'),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-05', length: 5 });
    expect(blocks[1]).toMatchObject({
      start: '2026-10-29',
      lastConfirmed: '2026-10-30',
      active: true,
    });
  });

  it('only lets the last start be active', () => {
    const blocks = periodBlocks([
      event('period-start', '2026-10-01'),
      event('period-start', '2026-10-29'),
    ]);
    expect(blocks[0]?.active).toBe(false);
    expect(blocks[1]?.active).toBe(true);
  });
});

describe('findActivePeriod', () => {
  it('returns the latest open period with its day count', () => {
    const active = findActivePeriod(
      [event('period-start', '2026-11-09'), event('period-day', '2026-11-10')],
      '2026-11-11',
    );
    expect(active).toMatchObject({
      start: '2026-11-09',
      lastConfirmed: '2026-11-10',
      days: 3,
      hasConfirmations: true,
    });
  });

  it('returns null once the period has an end', () => {
    expect(
      findActivePeriod(
        [event('period-start', '2026-11-09'), event('period-end', '2026-11-13')],
        '2026-11-14',
      ),
    ).toBeNull();
  });

  it('returns null for a start in the future', () => {
    expect(findActivePeriod([event('period-start', '2026-12-01')], '2026-11-16')).toBeNull();
  });
});

describe('endDateForActive', () => {
  it('uses the last confirmed day when there is one', () => {
    expect(
      endDateForActive(
        [event('period-start', '2026-11-09'), event('period-day', '2026-11-11')],
        '2026-11-14',
      ),
    ).toBe('2026-11-11');
  });

  it('assumes yesterday when nothing was confirmed', () => {
    expect(endDateForActive([event('period-start', '2026-11-09')], '2026-11-14')).toBe(
      '2026-11-13',
    );
  });

  it('uses the start day for a same-day period', () => {
    expect(endDateForActive([event('period-start', '2026-11-14')], '2026-11-14')).toBe(
      '2026-11-14',
    );
  });
});

describe('recordedPeriodDays', () => {
  it('includes every day in each block', () => {
    const days = recordedPeriodDays([
      event('period-start', '2026-11-09'),
      event('period-end', '2026-11-11'),
    ]);
    expect([...days].sort()).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });

  it('stops at the last confirmed day for an open period', () => {
    const days = recordedPeriodDays([
      event('period-start', '2026-11-09'),
      event('period-day', '2026-11-10'),
    ]);
    expect([...days].sort()).toEqual(['2026-11-09', '2026-11-10']);
  });
});


describe('periodRangeIssue', () => {
  const events = [
    event('period-start', '2026-10-01'),
    event('period-end', '2026-10-05'),
    event('period-start', '2026-10-29'),
    event('period-end', '2026-11-02'),
  ];

  it('accepts a valid completed range in a gap', () => {
    expect(periodRangeIssue(events, '2026-09-01', '2026-09-05', '2026-11-16')).toBeNull();
  });

  it('rejects invalid, future and reversed ranges', () => {
    expect(periodRangeIssue(events, '', '2026-09-05', '2026-11-16')).toBe('invalid');
    expect(periodRangeIssue(events, '2026-12-01', '2026-12-05', '2026-11-16')).toBe('future');
    expect(periodRangeIssue(events, '2026-09-01', '2026-09-05', '2026-09-03')).toBe('endFuture');
    expect(periodRangeIssue(events, '2026-09-05', '2026-09-01', '2026-11-16')).toBe('backwards');
  });

  it('rejects overlap and ranges crossing the next start', () => {
    expect(periodRangeIssue(events, '2026-10-03', '2026-10-06', '2026-11-16')).toBe('overlap');
    expect(periodRangeIssue(events, '2026-10-01', '2026-10-30', '2026-11-16')).toBe('overlap');
    expect(
      periodRangeIssue(events, '2026-11-03', '2026-11-04', '2026-11-16', '2026-10-01'),
    ).toBe('order');
  });

  it('only allows an open end for the latest cycle', () => {
    expect(periodRangeIssue(events, '2026-09-01', null, '2026-11-16')).toBe('openNotLatest');
    expect(periodRangeIssue(events, '2026-11-10', null, '2026-11-16')).toBeNull();
  });

  it('ignores the edited block when checking itself', () => {
    expect(
      periodRangeIssue(events, '2026-10-01', '2026-10-05', '2026-11-16', '2026-10-01'),
    ).toBeNull();
  });

  it('does not allow a completed period after an open one', () => {
    const open = [
      event('period-start', '2026-10-01'),
      event('period-end', '2026-10-05'),
      event('period-start', '2026-11-09'),
    ];
    expect(periodRangeIssue(open, '2026-11-10', '2026-11-12', '2026-11-16')).toBe('openActive');
    expect(
      periodRangeIssue(open, '2026-09-01', '2026-09-05', '2026-11-16'),
    ).toBeNull();
  });
});
