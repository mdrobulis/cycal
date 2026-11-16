import { describe, expect, it } from 'vitest';
import { computeStats } from './cycle';
import { cycleBar, cyclePhase } from './cycle-view';
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

describe('cycleBar', () => {
  it('positions the period, fertile, PMS, ovulation and today marks', () => {
    const bar = cycleBar(stats());
    expect(bar).not.toBeNull();
    expect(bar!.length).toBe(28);
    expect(bar!.period.from).toBe(0);
    expect(bar!.period.to).toBeCloseTo((5 / 28) * 100, 4);
    expect(bar!.fertile!.from).toBeCloseTo((9 / 28) * 100, 4);
    expect(bar!.fertile!.to).toBeCloseTo((16 / 28) * 100, 4);
    expect(bar!.pms!.from).toBeCloseTo((23 / 28) * 100, 4);
    expect(bar!.pms!.to).toBeCloseTo(100, 4);
    expect(bar!.ovulation).toBeCloseTo(50, 4);
    expect(bar!.today).toBeCloseTo((14.5 / 28) * 100, 4);
    expect(bar!.next).toBe(100);
  });

  it('is omitted when the estimate is not exact or not meaningful', () => {
    const oneCycle = computeStats(
      [event('period-start', '2026-11-02')],
      settings(),
      '2026-11-16',
    );
    expect(cycleBar(oneCycle)).toBeNull();
    expect(cycleBar(stats({ predictionMode: 'paused' }))).toBeNull();
    expect(cycleBar(stats({ predictionMode: 'irregular' }))).toBeNull();
    expect(cycleBar(stats())).not.toBeNull();
    expect(cycleBar(computeStats([], settings(), '2026-11-16'))).toBeNull();
  });
});
