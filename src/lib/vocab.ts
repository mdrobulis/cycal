import { COPY } from './strings';
import type { DayEvent, FlowValue, ProtectionValue, Severity } from './types';

export const SYMPTOMS = [
  'Pilvo skausmai',
  'Galvos skausmas',
  'Pilvo pūtimas',
  'Nuovargis',
  'Nugaros skausmas',
  'Pykinimas',
  'Krūtų jautrumas',
  'Spuogai',
  'Potraukis maistui',
  'Galvos svaigimas',
  'Nemiga',
] as const;

export const MOODS = ['Blogai', 'Prastai', 'Vidutiniškai', 'Gerai', 'Puikiai'] as const;

export const FLOWS: ReadonlyArray<{ value: FlowValue; label: string }> = [
  { value: 'light', label: 'Lengvas' },
  { value: 'medium', label: 'Vidutinis' },
  { value: 'heavy', label: 'Stiprus' },
];

export const SEVERITIES: ReadonlyArray<{ value: Severity; label: string }> = [
  { value: 1, label: 'Silpnas' },
  { value: 2, label: 'Vidutinis' },
  { value: 3, label: 'Stiprus' },
];

export const PROTECTIONS: ReadonlyArray<{ value: ProtectionValue; label: string }> = [
  { value: 'protected', label: 'Apsaugotas' },
  { value: 'unprotected', label: 'Neapsaugotas' },
];

export function severityLabel(value: unknown): string {
  return SEVERITIES.find((entry) => entry.value === value)?.label ?? '';
}

export function moodLabel(value: unknown): string {
  return typeof value === 'number' && value >= 1 && value <= 5
    ? MOODS[value - 1]!
    : COPY.sheet.mood;
}

export function flowLabel(value: unknown): string {
  return FLOWS.find((entry) => entry.value === value)?.label ?? '';
}

export function protectionLabel(value: unknown): string {
  return PROTECTIONS.find((entry) => entry.value === value)?.label ?? '';
}

export function eventLabel(event: DayEvent): string {
  switch (event.kind) {
    case 'period-start':
      return COPY.period.started;
    case 'period-day':
      return COPY.period.bleeding;
    case 'period-end':
      return COPY.period.finished;
    case 'symptom':
      return event.label ?? COPY.sheet.symptom;
    case 'mood':
      return COPY.sheet.mood;
    case 'flow':
      return COPY.sheet.flow;
    case 'intimacy':
      return COPY.sheet.intimacy;
    case 'note':
      return COPY.sheet.note;
    case 'custom':
      return event.label ?? COPY.sheet.custom;
  }
}

export function eventDetail(event: DayEvent): string {
  switch (event.kind) {
    case 'symptom':
      return [
        event.severity ? severityLabel(event.severity) : '',
        event.note ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
    case 'mood':
      return moodLabel(event.value);
    case 'flow':
      return flowLabel(event.value);
    case 'intimacy':
      return protectionLabel(event.value) || COPY.sheet.protectionUnknown;
    case 'note':
      return event.note ?? '';
    case 'custom':
      return event.note ?? '';
    default:
      return '';
  }
}
