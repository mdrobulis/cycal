import { describe, expect, it } from 'vitest';
import {
  endDateForActive,
  findActivePeriod,
  periodBlocks,
  periodDisplayDays,
  periodRangeIssue,
  recordedPeriodDays,
} from './periods';
import { event } from './test-utils';

const TODAY = '2026-11-16';

describe('periodBlocks', () => {
  it('keeps a fresh start-only period open and active', () => {
    const [block] = periodBlocks([event('period-start', '2026-11-09')], TODAY);
    expect(block).toMatchObject({
      start: '2026-11-09',
      lastConfirmed: '2026-11-09',
      open: true,
      active: true,
      stale: false,
      displayEnd: '2026-11-09',
      hasConfirmations: false,
    });
    expect(block?.end).toBeUndefined();
    expect(block?.length).toBeUndefined();
  });

  it('extends a fresh open period through confirmed days and today', () => {
    const [block] = periodBlocks(
      [
        event('period-start', '2026-11-09'),
        event('period-day', '2026-11-10'),
        event('period-day', '2026-11-11'),
      ],
      TODAY,
    );
    expect(block?.lastConfirmed).toBe('2026-11-11');
    expect(block?.active).toBe(true);
    expect(block?.hasConfirmations).toBe(true);
    expect(block?.displayEnd).toBe('2026-11-11');
  });

  it('closes at an explicit end and measures the length', () => {
    const [block] = periodBlocks(
      [
        event('period-start', '2026-11-09'),
        event('period-day', '2026-11-10'),
        event('period-end', '2026-11-13'),
      ],
      TODAY,
    );
    expect(block).toMatchObject({
      end: '2026-11-13',
      displayEnd: '2026-11-13',
      length: 5,
      open: false,
      active: false,
      stale: false,
    });
  });

  it('marks a start-only period older than 10 days as stale', () => {
    const [block] = periodBlocks([event('period-start', '2026-11-02')], TODAY);
    expect(block).toMatchObject({
      open: true,
      active: false,
      stale: true,
      displayEnd: '2026-11-02',
    });
  });

  it('keeps the 10-day boundary active and the 11th day stale', () => {
    const [boundary] = periodBlocks([event('period-start', '2026-11-06')], TODAY);
    const [stale] = periodBlocks([event('period-start', '2026-11-05')], TODAY);
    expect(boundary?.active).toBe(true);
    expect(stale?.stale).toBe(true);
  });

  it('ignores an end before the start', () => {
    const [block] = periodBlocks(
      [event('period-start', '2026-11-09'), event('period-end', '2026-11-07')],
      TODAY,
    );
    expect(block?.end).toBeUndefined();
    expect(block?.active).toBe(true);
  });

  it('keeps two periods separate and only the latest can be active', () => {
    const blocks = periodBlocks(
      [
        event('period-start', '2026-10-01'),
        event('period-end', '2026-10-05'),
        event('period-start', '2026-10-29'),
        event('period-day', '2026-10-30'),
      ],
      '2026-11-01',
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-05', length: 5 });
    expect(blocks[1]).toMatchObject({
      start: '2026-10-29',
      lastConfirmed: '2026-10-30',
      active: true,
    });
  });

  it('does not make an older open period active when a newer start exists', () => {
    const blocks = periodBlocks(
      [event('period-start', '2026-10-01'), event('period-start', '2026-10-29')],
      TODAY,
    );
    expect(blocks[0]?.active).toBe(false);
    expect(blocks[1]?.active).toBe(false);
    expect(blocks[1]?.stale).toBe(true);
  });
});

describe('periodDisplayDays', () => {
  it('includes every day in a closed block', () => {
    const days = periodDisplayDays(
      [event('period-start', '2026-11-09'), event('period-end', '2026-11-11')],
      TODAY,
    );
    expect([...days].sort()).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });

  it('marks a fresh start-only period only on its recorded start', () => {
    const days = periodDisplayDays([event('period-start', '2026-11-09')], TODAY);
    expect([...days]).toEqual(['2026-11-09']);
  });

  it('does not paint a stale open period through today', () => {
    const days = periodDisplayDays(
      [event('period-start', '2026-10-26'), event('period-day', '2026-10-27')],
      TODAY,
    );
    expect([...days].sort()).toEqual(['2026-10-26', '2026-10-27']);
  });
});

describe('findActivePeriod', () => {
  it('returns the latest fresh open period with its day count', () => {
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

  it('returns null for a stale start-only period', () => {
    expect(findActivePeriod([event('period-start', '2026-10-26')], TODAY)).toBeNull();
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
    expect(findActivePeriod([event('period-start', '2026-12-01')], TODAY)).toBeNull();
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
    expect(
      endDateForActive([event('period-start', '2026-11-14')], '2026-11-14'),
    ).toBe('2026-11-14');
  });
});

describe('recordedPeriodDays', () => {
  it('uses the same display set as periodDisplayDays', () => {
    const events = [event('period-start', '2026-11-09'), event('period-end', '2026-11-11')];
    expect([...recordedPeriodDays(events, TODAY)].sort()).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
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
    expect(periodRangeIssue(events, '2026-09-01', '2026-09-05', TODAY)).toBeNull();
  });

  it('rejects invalid, future and reversed ranges', () => {
    expect(periodRangeIssue(events, '', '2026-09-05', TODAY)).toBe('invalid');
    expect(periodRangeIssue(events, '2026-12-01', '2026-12-05', TODAY)).toBe('future');
    expect(periodRangeIssue(events, '2026-09-01', '2026-09-05', '2026-09-03')).toBe(
      'endFuture',
    );
    expect(periodRangeIssue(events, '2026-09-05', '2026-09-01', TODAY)).toBe('backwards');
  });

  it('rejects overlap and ranges crossing the next start', () => {
    expect(periodRangeIssue(events, '2026-10-03', '2026-10-06', TODAY)).toBe('overlap');
    expect(periodRangeIssue(events, '2026-10-01', '2026-10-30', TODAY)).toBe('overlap');
    expect(
      periodRangeIssue(events, '2026-11-03', '2026-11-04', TODAY, '2026-10-01'),
    ).toBe('order');
  });

  it('only allows an open end for the latest cycle', () => {
    expect(periodRangeIssue(events, '2026-09-01', null, TODAY)).toBe('openNotLatest');
    expect(periodRangeIssue(events, '2026-11-10', null, TODAY)).toBeNull();
  });

  it('ignores the edited block when checking itself', () => {
    expect(
      periodRangeIssue(events, '2026-10-01', '2026-10-05', TODAY, '2026-10-01'),
    ).toBeNull();
  });

  it('does not allow a completed period after a fresh open one', () => {
    const open = [
      event('period-start', '2026-10-01'),
      event('period-end', '2026-10-05'),
      event('period-start', '2026-11-09'),
    ];
    expect(periodRangeIssue(open, '2026-11-10', '2026-11-12', TODAY)).toBe('openActive');
    expect(periodRangeIssue(open, '2026-09-01', '2026-09-05', TODAY)).toBeNull();
  });

  it('allows a later period after a stale open start', () => {
    const stale = [event('period-start', '2026-10-20')];
    expect(periodRangeIssue(stale, '2026-11-10', '2026-11-12', TODAY)).toBeNull();
  });
});
