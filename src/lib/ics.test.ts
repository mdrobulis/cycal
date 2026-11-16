import { describe, expect, it } from 'vitest';
import { buildPredictionICS, foldLine } from './ics';
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
    expect(text).toContain('SUMMARY:Mėnesinės (prognozė)');
    expect(text).toContain('SUMMARY:Vaisingos dienos (prognozė)');
    expect(text).toContain('SUMMARY:PMS (prognozė)');
    expect(text).toContain('UID:cycal-period-2026-12-07@cycal.local');
    expect(text).toContain('Ovuliacija apie 2026-11-23');
    expect(text).toContain('ne kontracepcija');
  });

  it('keeps every content line within 75 UTF-8 bytes', () => {
    const text = buildPredictionICS(
      [event('period-start', '2026-11-09')],
      settings(),
      '2026-11-16',
      NOW,
    );
    const encoder = new TextEncoder();
    const lines = text.split('\r\n');
    for (const line of lines) {
      expect(encoder.encode(line).length, line).toBeLessThanOrEqual(75);
    }
  });

  it('folds long Lithuanian lines at a code point boundary', () => {
    const line = `DESCRIPTION:${'ė'.repeat(80)}`;
    const folded = foldLine(line);
    const encoder = new TextEncoder();
    for (const chunk of folded.split('\r\n')) {
      expect(encoder.encode(chunk).length).toBeLessThanOrEqual(75);
    }
    expect(folded).not.toContain('\uFFFD');
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('refuses paused and irregular predictions', () => {
    expect(() =>
      buildPredictionICS(
        [event('period-start', '2026-11-09')],
        settings({ predictionMode: 'paused' }),
        '2026-11-16',
        NOW,
      ),
    ).toThrow(/negalimos/);

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
    ).toThrow(/negalimos/);
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
