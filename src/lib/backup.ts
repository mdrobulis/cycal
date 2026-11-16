import { diffDays, isDayKey } from './date';
import { normalizeSettings, type DayEvent, type Settings } from './types';

const KINDS = new Set([
  'period-start',
  'period-day',
  'period-end',
  'symptom',
  'mood',
  'flow',
  'intimacy',
  'note',
  'custom',
]);

export interface BackupFile {
  app: 'cycal';
  schema: 1;
  exportedAt: string;
  events: DayEvent[];
  settings: Settings;
}

export function isValidEvent(value: unknown): value is DayEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== 'string' || event.id.length === 0) return false;
  if (typeof event.date !== 'string' || !isDayKey(event.date)) return false;
  if (typeof event.kind !== 'string' || !KINDS.has(event.kind)) return false;
  if (event.label !== undefined && typeof event.label !== 'string') return false;
  if (event.note !== undefined && typeof event.note !== 'string') return false;
  if (
    event.value !== undefined &&
    typeof event.value !== 'number' &&
    typeof event.value !== 'string'
  ) {
    return false;
  }
  if (
    event.severity !== undefined &&
    event.severity !== 1 &&
    event.severity !== 2 &&
    event.severity !== 3
  ) {
    return false;
  }
  return typeof event.createdAt === 'string';
}

export function buildBackup(events: DayEvent[], settings: Settings): BackupFile {
  return {
    app: 'cycal',
    schema: 1,
    exportedAt: new Date().toISOString(),
    events,
    settings,
  };
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('That file is not a Cycal backup.');
  }
  const record = data as Record<string, unknown>;
  if (record.app !== 'cycal') throw new Error('That file is not a Cycal backup.');
  if (record.schema !== 1) {
    throw new Error(`Unsupported backup version: ${String(record.schema)}.`);
  }
  if (!Array.isArray(record.events)) throw new Error('The backup has no event list.');
  if (!record.events.every(isValidEvent)) {
    throw new Error('The backup contains events Cycal cannot read.');
  }
  return {
    app: 'cycal',
    schema: 1,
    exportedAt:
      typeof record.exportedAt === 'string' ? record.exportedAt : new Date().toISOString(),
    events: record.events,
    settings: normalizeSettings(record.settings as Partial<Settings> | undefined),
  };
}

export function mergeEvents(existing: DayEvent[], incoming: DayEvent[]): DayEvent[] {
  const byId = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

export function backupAgeDays(lastExportAt: string | undefined, today: string): number | null {
  if (!lastExportAt) return null;
  const key = lastExportAt.slice(0, 10);
  if (!isDayKey(key)) return null;
  return Math.max(0, diffDays(key, today));
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBackup(events: DayEvent[], settings: Settings): BackupFile {
  const file = buildBackup(events, settings);
  downloadText(
    `cycal-backup-${file.exportedAt.slice(0, 10)}.json`,
    JSON.stringify(file, null, 2),
    'application/json',
  );
  return file;
}
