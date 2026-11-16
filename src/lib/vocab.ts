import type { DayEvent, FlowValue, Severity } from './types';

export const SYMPTOMS = [
  'Cramps',
  'Headache',
  'Bloating',
  'Fatigue',
  'Back pain',
  'Nausea',
  'Tender breasts',
  'Acne',
  'Cravings',
  'Dizziness',
  'Insomnia',
] as const;

export const MOODS = ['Awful', 'Low', 'Okay', 'Good', 'Great'] as const;

export const FLOWS: ReadonlyArray<{ value: FlowValue; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

export const SEVERITIES: ReadonlyArray<{ value: Severity; label: string }> = [
  { value: 1, label: 'Mild' },
  { value: 2, label: 'Moderate' },
  { value: 3, label: 'Severe' },
];

export function severityLabel(value: unknown): string {
  return SEVERITIES.find((s) => s.value === value)?.label ?? '';
}

export function moodLabel(value: unknown): string {
  return typeof value === 'number' && value >= 1 && value <= 5 ? MOODS[value - 1]! : 'Mood';
}

export function flowLabel(value: unknown): string {
  return FLOWS.find((f) => f.value === value)?.label ?? '';
}

export function eventLabel(event: DayEvent): string {
  switch (event.kind) {
    case 'period-start':
      return 'Period started';
    case 'period-day':
      return 'Bleeding';
    case 'period-end':
      return 'Period ended';
    case 'symptom':
      return event.label ?? 'Symptom';
    case 'mood':
      return 'Mood';
    case 'flow':
      return 'Flow';
    case 'intimacy':
      return 'Intimacy';
    case 'note':
      return 'Note';
    case 'custom':
      return event.label ?? 'Custom';
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
    case 'note':
      return event.note ?? '';
    case 'custom':
      return event.note ?? '';
    default:
      return '';
  }
}
