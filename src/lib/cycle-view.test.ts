import { describe, expect, it } from 'vitest';
import { computeStats } from './cycle';
import {
  cyclePhase,
  dayCountdown,
  nextPeriodCountdown,
  rangeCountdown,
} from './cycle-view';
import { event, settings } from './test-utils';

function stats(overrides = {}) {
  return computeStats(
    [
      event('period-start', '2026-10-05'),
      event('period-end', '2026-10-09'),
      event('period-start', '2026-11-02'),
      event('period-end', '2026-11-06'),
    ],
    settings(overrides),
    '2026-11-16',
  );
}

describe('cyclePhase', () => {
  it('identifies the period', () => {
    expect(cyclePhase(stats(), '2026-11-03')).toBe('period');
  });

  it('identifies ovulation, fertile and PMS days', () => {
    expect(cyclePhase(stats(), '2026-11-16')).toBe('ovulation');
    expect(cyclePhase(stats(), '2026-11-12')).toBe('fertile');
    expect(cyclePhase(stats(), '2026-11-26')).toBe('pms');
  });

  it('identifies the luteal phase and a late period', () => {
    expect(cyclePhase(stats(), '2026-11-20')).toBe('luteal');
    expect(cyclePhase(stats(), '2026-12-01')).toBe('late');
  });

  it('handles paused, irregular and empty states', () => {
    expect(cyclePhase(stats({ predictionMode: 'paused' }), '2026-11-12')).toBe('paused');
    expect(cyclePhase(stats({ predictionMode: 'irregular' }), '2026-11-12')).toBe('irregular');
    expect(
      cyclePhase(computeStats([], settings(), '2026-11-16'), '2026-11-16'),
    ).toBe('none');
  });
});

describe('dayCountdown', () => {
  it('counts future days, today and past days', () => {
    expect(dayCountdown('2026-11-16', '2026-11-30')).toEqual({
      state: 'future',
      days: 14,
    });
    expect(dayCountdown('2026-11-16', '2026-11-16')).toEqual({ state: 'today' });
    expect(dayCountdown('2026-11-16', '2026-11-10')).toEqual({ state: 'past' });
    expect(dayCountdown('2026-11-16')).toEqual({ state: 'none' });
  });
});

describe('rangeCountdown', () => {
  const range = { from: '2026-11-25', to: '2026-11-29' };

  it('counts to the range start', () => {
    expect(rangeCountdown('2026-11-16', range)).toEqual({
      state: 'future',
      days: 9,
    });
  });

  it('is today inside the range', () => {
    expect(rangeCountdown('2026-11-27', range)).toEqual({ state: 'today' });
  });

  it('is past after the range', () => {
    expect(rangeCountdown('2026-11-30', range)).toEqual({ state: 'past' });
    expect(rangeCountdown('2026-11-16')).toEqual({ state: 'none' });
  });
});

describe('nextPeriodCountdown', () => {
  it('uses the exact next start', () => {
    expect(nextPeriodCountdown(stats(), '2026-11-16')).toEqual({
      state: 'future',
      days: 14,
    });
    expect(nextPeriodCountdown(stats(), '2026-11-30')).toEqual({ state: 'today' });
  });

  it('reports a late exact start', () => {
    expect(nextPeriodCountdown(stats(), '2026-12-02')).toEqual({
      state: 'late',
      days: 2,
    });
  });

  it('uses a range window and reports a late window', () => {
    const base = stats();
    const ranged = {
      ...base,
      nextStart: undefined,
      nextRange: { from: '2026-11-25', to: '2026-11-30' },
    };
    expect(nextPeriodCountdown(ranged, '2026-11-16')).toEqual({
      state: 'future',
      days: 9,
    });
    expect(nextPeriodCountdown(ranged, '2026-11-27')).toEqual({ state: 'today' });
    expect(nextPeriodCountdown(ranged, '2026-12-03')).toEqual({
      state: 'late',
      days: 3,
    });
  });

  it('is none without a prediction', () => {
    expect(nextPeriodCountdown(computeStats([], settings(), '2026-11-16'), '2026-11-16')).toEqual({
      state: 'none',
    });
  });
});
