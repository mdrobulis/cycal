import { describe, expect, it } from 'vitest';
import { COPY } from './strings';
import { event } from './test-utils';
import { PROTECTIONS, eventDetail, eventLabel, protectionLabel } from './vocab';

describe('intimacy protection', () => {
  it('labels both protection states in order', () => {
    expect(PROTECTIONS.map((entry) => entry.value)).toEqual(['protected', 'unprotected']);
    expect(protectionLabel('protected')).toBe('Apsaugotas');
    expect(protectionLabel('unprotected')).toBe('Neapsaugotas');
  });

  it('falls back to empty text for an unknown value', () => {
    expect(protectionLabel(undefined)).toBe('');
    expect(protectionLabel('other')).toBe('');
  });

  it('renders the protection state as the event detail', () => {
    expect(eventDetail(event('intimacy', '2026-11-09', { value: 'protected' }))).toBe(
      'Apsaugotas',
    );
    expect(eventDetail(event('intimacy', '2026-11-09', { value: 'unprotected' }))).toBe(
      'Neapsaugotas',
    );
  });

  it('marks legacy records without a usable value as unspecified', () => {
    expect(eventDetail(event('intimacy', '2026-11-09'))).toBe(COPY.sheet.protectionUnknown);
    expect(eventDetail(event('intimacy', '2026-11-09', { value: 'other' }))).toBe(
      COPY.sheet.protectionUnknown,
    );
  });

  it('keeps the intimacy event label unchanged', () => {
    expect(eventLabel(event('intimacy', '2026-11-09', { value: 'protected' }))).toBe(
      COPY.sheet.intimacy,
    );
  });
});
