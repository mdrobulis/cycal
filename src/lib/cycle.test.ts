import { describe, expect, it } from 'vitest';
import { canProject, computeHistory, computeStats, projectCycles } from './cycle';
import { event, settings } from './test-utils';

const TODAY = '2026-11-16';

describe('computeStats', () => {
  it('is empty with no events', () => {
    const stats = computeStats([], settings(), TODAY);
    expect(stats.cycleCount).toBe(0);
    expect(stats.cycleDay).toBeUndefined();
    expect(stats.nextStart).toBeUndefined();
    expect(stats.predictedPeriodDays.size).toBe(0);
    expect(stats.lastPeriod).toBeUndefined();
    expect(stats.pendingBleeding).toBe(false);
  });

  it('uses the default cycle length after the first start', () => {
    const stats = computeStats([event('period-start', '2026-11-09')], settings(), TODAY);
    expect(stats.cycleDay).toBe(8);
    expect(stats.nextStart).toBe('2026-12-07');
    expect(stats.usingDefault).toBe(true);
    expect(stats.predictedPeriodDays.size).toBe(5);
    expect(stats.fertileRange).toEqual({ from: '2026-11-18', to: '2026-11-24' });
    expect(stats.ovulation).toBe('2026-11-23');
    expect(stats.pmsRange).toEqual({ from: '2026-12-02', to: '2026-12-06' });
  });

  it('uses the median of recorded lengths with two starts', () => {
    const stats = computeStats(
      [event('period-start', '2026-11-09'), event('period-start', '2026-12-07')],
      settings(),
      '2026-12-10',
    );
    expect(stats.cycleDay).toBe(4);
    expect(stats.medianCycleLength).toBe(28);
    expect(stats.nextStart).toBe('2027-01-04');
    expect(stats.usingDefault).toBe(false);
    expect(stats.predictedPeriodDays.has('2027-01-04')).toBe(true);
    expect(stats.predictedPeriodDays.has('2027-01-08')).toBe(true);
  });

  it('switches to a range when recent cycles vary by more than four days', () => {
    const stats = computeStats(
      [
        event('period-start', '2026-10-01'),
        event('period-start', '2026-10-28'),
        event('period-start', '2026-12-01'),
      ],
      settings(),
      '2026-12-10',
    );
    expect(stats.irregular).toBe(true);
    expect(stats.nextStart).toBeUndefined();
    expect(stats.nextRange).toEqual({ from: '2026-12-28', to: '2027-01-04' });
    expect(stats.fertileRange).toBeUndefined();
    expect(stats.ovulation).toBeUndefined();
    expect(stats.pmsRange).toBeUndefined();
    expect(stats.predictedPeriodDays.size).toBe(8);
  });

  it('honours the irregular mode even when the spread is small', () => {
    const stats = computeStats(
      [
        event('period-start', '2026-10-01'),
        event('period-start', '2026-10-29'),
        event('period-start', '2026-11-26'),
      ],
      settings({ predictionMode: 'irregular' }),
      '2026-12-01',
    );
    expect(stats.irregular).toBe(true);
    expect(stats.nextRange).toEqual({ from: '2026-12-24', to: '2026-12-24' });
    expect(stats.nextStart).toBeUndefined();
    expect(stats.fertileRange).toBeUndefined();
  });

  it('has no predictions when paused', () => {
    const stats = computeStats(
      [event('period-start', '2026-11-09')],
      settings({ predictionMode: 'paused' }),
      TODAY,
    );
    expect(stats.paused).toBe(true);
    expect(stats.nextStart).toBeUndefined();
    expect(stats.nextRange).toBeUndefined();
    expect(stats.fertileRange).toBeUndefined();
    expect(stats.ovulation).toBeUndefined();
    expect(stats.pmsRange).toBeUndefined();
    expect(stats.predictedPeriodDays.size).toBe(0);
    expect(stats.cycleDay).toBe(8);
  });

  it('measures period length from start and end', () => {
    const stats = computeStats(
      [
        event('period-start', '2026-10-01'),
        event('period-end', '2026-10-05'),
        event('period-start', '2026-10-29'),
        event('period-end', '2026-11-02'),
      ],
      settings(),
      TODAY,
    );
    expect(stats.periodLengthForPrediction).toBe(5);
    expect(stats.nextStart).toBe('2026-11-26');
    expect([...stats.predictedPeriodDays].sort()).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
    ]);
  });

  it('reports how late an expected period is', () => {
    const stats = computeStats(
      [event('period-start', '2026-10-01')],
      settings(),
      '2026-11-16',
    );
    expect(stats.nextStart).toBe('2026-10-29');
    expect(stats.daysLate).toBe(18);
  });

  it('tracks an open period', () => {
    const stats = computeStats(
      [event('period-start', '2026-11-09'), event('period-day', '2026-11-10')],
      settings(),
      TODAY,
    );
    expect(stats.pendingBleeding).toBe(true);
    expect(stats.lastPeriod).toMatchObject({
      start: '2026-11-09',
      lastConfirmed: '2026-11-10',
      active: true,
    });
  });
});

describe('computeHistory', () => {
  it('lists completed lengths and marks the current cycle', () => {
    const history = computeHistory(
      [
        event('period-start', '2026-09-03'),
        event('period-start', '2026-10-01'),
        event('period-start', '2026-10-29'),
        event('period-end', '2026-11-02'),
      ],
      TODAY,
    );
    expect(history).toHaveLength(3);
    expect(history[0]?.cycleLength).toBe(28);
    expect(history[1]?.cycleLength).toBe(28);
    expect(history[2]?.current).toBe(true);
    expect(history[2]?.cycleLength).toBeUndefined();
    expect(history[2]?.periodLength).toBe(5);
  });

  it('respects the limit', () => {
    const events = Array.from({ length: 20 }, (_, index) =>
      event('period-start', `2024-${String((index % 12) + 1).padStart(2, '0')}-01`),
    );
    expect(computeHistory(events, TODAY, 12)).toHaveLength(12);
  });
});

describe('projection', () => {
  it('projects three cycles from the default length', () => {
    const stats = computeStats([event('period-start', '2026-11-09')], settings(), TODAY);
    const cycles = projectCycles(stats, settings(), 3);
    expect(cycles).toHaveLength(3);
    expect(cycles[0]?.start).toBe('2026-12-07');
    expect(cycles[0]?.periodDays).toHaveLength(5);
    expect(cycles[0]?.ovulation).toBe('2026-11-23');
    expect(cycles[1]?.start).toBe('2027-01-04');
    expect(cycles[2]?.start).toBe('2027-02-01');
  });

  it('refuses to project when paused or irregular', () => {
    const paused = computeStats(
      [event('period-start', '2026-11-09')],
      settings({ predictionMode: 'paused' }),
      TODAY,
    );
    expect(canProject(paused)).toBe(false);
    expect(projectCycles(paused, settings(), 3)).toEqual([]);

    const irregular = computeStats(
      [
        event('period-start', '2026-10-01'),
        event('period-start', '2026-10-28'),
        event('period-start', '2026-12-01'),
      ],
      settings(),
      '2026-12-10',
    );
    expect(canProject(irregular)).toBe(false);
  });
});
