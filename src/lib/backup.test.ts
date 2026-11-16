import { describe, expect, it } from 'vitest';
import {
  backupAgeDays,
  buildBackup,
  isValidEvent,
  mergeEvents,
  parseBackup,
} from './backup';
import { normalizeSettings } from './types';
import { event, settings } from './test-utils';

describe('backup round trip', () => {
  it('parses what it builds', () => {
    const events = [event('period-start', '2026-11-09'), event('symptom', '2026-11-10', { label: 'Cramps', severity: 2 })];
    const file = buildBackup(events, settings({ cycleLengthDefault: 30 }));
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.events).toHaveLength(2);
    expect(parsed.settings.cycleLengthDefault).toBe(30);
    expect(parsed.app).toBe('cycal');
    expect(parsed.schema).toBe(1);
  });

  it('round-trips intimacy protection', () => {
    const file = buildBackup(
      [event('intimacy', '2026-11-09', { value: 'protected' })],
      settings(),
    );
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.events.map((item) => item.value)).toEqual(['protected']);
  });

  it('rejects a file from another app', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', schema: 1, events: [] }))).toThrow(
      /Tai ne Cycal kopija/,
    );
  });

  it('rejects an unknown schema', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'cycal', schema: 2, events: [] }))).toThrow(
      /Nepalaikoma kopijos versija/,
    );
  });

  it('rejects unreadable events', () => {
    const file = buildBackup([event('period-start', '2026-11-09')], settings());
    const broken = {
      ...file,
      events: [{ ...file.events[0], date: '2026-02-30' }],
    };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/neperskaito/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{oops')).toThrow(/netinkamas JSON/);
  });
});

describe('event validation', () => {
  it('accepts a full event', () => {
    expect(
      isValidEvent({
        id: '1',
        date: '2026-11-09',
        kind: 'symptom',
        label: 'Cramps',
        severity: 3,
        note: 'evening',
        createdAt: '2026-11-09T10:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('accepts intimacy with and without a protection value', () => {
    expect(isValidEvent(event('intimacy', '2026-11-09', { value: 'protected' }))).toBe(true);
    expect(isValidEvent(event('intimacy', '2026-11-09'))).toBe(true);
  });

  it('rejects bad severity, date and kind', () => {
    expect(
      isValidEvent({
        id: '1',
        date: '2026-11-09',
        kind: 'symptom',
        severity: 4,
        createdAt: 'x',
      }),
    ).toBe(false);
    expect(
      isValidEvent({ id: '1', date: 'nope', kind: 'note', createdAt: 'x' }),
    ).toBe(false);
    expect(
      isValidEvent({ id: '1', date: '2026-11-09', kind: 'weather', createdAt: 'x' }),
    ).toBe(false);
  });
});

describe('mergeEvents', () => {
  it('keeps both sets and lets the incoming copy win', () => {
    const first = event('period-start', '2026-11-09');
    const second = event('period-start', '2026-12-07');
    const merged = mergeEvents([first], [second, { ...first, date: '2026-11-10' }]);
    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.id === first.id)?.date).toBe('2026-11-10');
  });
});

describe('backupAgeDays', () => {
  it('counts whole days', () => {
    expect(backupAgeDays('2026-11-01T08:00:00.000Z', '2026-11-16')).toBe(15);
  });

  it('returns null without a usable timestamp', () => {
    expect(backupAgeDays(undefined, '2026-11-16')).toBeNull();
    expect(backupAgeDays('nonsense', '2026-11-16')).toBeNull();
  });
});

describe('normalizeSettings', () => {
  it('clamps lengths and falls back for an unknown mode', () => {
    const normalized = normalizeSettings({
      cycleLengthDefault: 100,
      periodLengthDefault: 1,
      predictionMode: 'sometimes' as never,
    });
    expect(normalized.cycleLengthDefault).toBe(45);
    expect(normalized.periodLengthDefault).toBe(2);
    expect(normalized.predictionMode).toBe('auto');
  });
});
