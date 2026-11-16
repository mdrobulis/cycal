import type { EventKind } from './types';

export type IconName =
  | 'settings'
  | 'back'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'trash'
  | 'plus'
  | 'check'
  | 'calendar'
  | 'droplet'
  | 'leaf'
  | 'ovum'
  | 'moon'
  | 'pulse'
  | 'face'
  | 'heart'
  | 'note'
  | 'star'
  | 'pencil'
  | 'history';

export type UserEventKind = Exclude<EventKind, 'period-start' | 'period-day' | 'period-end'>;

export const EVENT_ORDER: readonly UserEventKind[] = [
  'symptom',
  'mood',
  'flow',
  'intimacy',
  'note',
  'custom',
];

export const EVENT_ICON: Record<UserEventKind, IconName> = {
  symptom: 'pulse',
  mood: 'face',
  flow: 'droplet',
  intimacy: 'heart',
  note: 'note',
  custom: 'star',
};

export function eventIcon(kind: EventKind): IconName | null {
  return kind in EVENT_ICON ? EVENT_ICON[kind as UserEventKind] : null;
}
