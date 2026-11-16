import { DEFAULT_SETTINGS, type DayEvent, type EventKind, type Settings } from './types';

let nextId = 0;

export function event(
  kind: EventKind,
  date: string,
  extra: Partial<DayEvent> = {},
): DayEvent {
  nextId += 1;
  return {
    id: `event-${nextId}`,
    date,
    kind,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

export function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
