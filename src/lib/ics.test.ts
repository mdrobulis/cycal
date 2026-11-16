import { describe, expect, it } from 'vitest';
import { buildPredictionICS } from './ics';
import { event, settings } from './test-utils';

const NOW = new Date('2026-11-16T08:00:00Z');

describe('prediction calendar export', () => {
  it('writes three cycles of all-day events', () => {
    const text = buildPredictionICS(
      [event('period-start', '2026-11-09')],
      settings(),
      '2026-11-16',
      NOW,
    );

    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(9);
    expect(text).toContain('DTSTAMP:20261116T080000Z');
    expect(text).toContain('DTSTART;VALUE=DATE:20261207');
    expect(text).toContain('DTEND;VALUE=DATE:20261212');
    expect(text).toContain('SUMMARY:Period (estimate)');
    expect(text).toContain('SUMMARY:Fertile window (estimate)');
    expect(text).toContain('SUMMARY:PMS window (estimate)');
    expect(text).toContain('UID:cycal-period-2026-12-07@cycal.local');
    expect(text).toContain('Estimated ovulation around 2026-11-23');
    expect(text).toContain('not contraception');
  });

  it('keeps every content line within 75 characters', () => {
    const text = buildPredictionICS(
      [event('period-start', '2026-11-09')],
      settings(),
      '2026-11-16',
      NOW,
    );
    const lines = text.split('\r\n');
    for (const line of lines) {
      expect(line.length, line).toBeLessThanOrEqual(75);
    }
  });

  it('refuses paused and irregular predictions', () => {
    expect(() =>
      buildPredictionICS(
        [event('period-start', '2026-11-09')],
        settings({ predictionMode: 'paused' }),
        '2026-11-16',
        NOW,
      ),
    ).toThrow(/not available/);

    expect(() =>
      buildPredictionICS(
        [
          event('period-start', '2026-10-01'),
          event('period-start', '2026-10-28'),
          event('period-start', '2026-12-01'),
        ],
        settings(),
        '2026-12-10',
        NOW,
      ),
    ).toThrow(/not available/);
  });

  it('uses an exclusive end date for the period block', () => {
    const text = buildPredictionICS(
      [event('period-start', '2026-11-09')],
      settings({ periodLengthDefault: 4 }),
      '2026-11-16',
      NOW,
    );
    expect(text).toContain('DTSTART;VALUE=DATE:20261207');
    expect(text).toContain('DTEND;VALUE=DATE:20261211');
  });
});
