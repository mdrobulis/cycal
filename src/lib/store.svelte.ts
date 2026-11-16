import { addDays, todayKey } from './date';
import { computeHistory, computeStats } from './cycle';
import { endDateForActive, findActivePeriod, periodCoversDate } from './periods';
import * as db from './db';
import { isValidEvent, mergeEvents } from './backup';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type ActivePeriod,
  type CycleStats,
  type DayEvent,
  type DayKey,
  type EventKind,
  type HistoryCycle,
  type NewEvent,
  type Severity,
  type Settings,
  type UndoState,
} from './types';

function sortEvents(events: DayEvent[]): DayEvent[] {
  return [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class CycalStore {
  events = $state<DayEvent[]>([]);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  ready = $state(false);
  storageBlocked = $state(false);
  today = $state<DayKey>(todayKey());
  undo = $state<UndoState | null>(null);

  byDay = $derived.by(() => {
    const map = new Map<DayKey, DayEvent[]>();
    for (const event of this.events) {
      const list = map.get(event.date);
      if (list) list.push(event);
      else map.set(event.date, [event]);
    }
    return map;
  });

  stats = $derived(computeStats(this.events, this.settings, this.today));
  history = $derived(computeHistory(this.events, this.today));
  activePeriod = $derived(findActivePeriod(this.events, this.today));

  #undoTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    this.refreshToday();
    try {
      const [events, settings] = await Promise.all([
        db.getAllEvents(),
        db.getMeta<Settings>('settings'),
      ]);
      this.events = sortEvents(events.filter(isValidEvent));
      this.settings = normalizeSettings(settings);
    } catch (error) {
      console.error('Cycal storage unavailable', error);
      this.storageBlocked = true;
    } finally {
      this.ready = true;
    }
  }

  refreshToday(): void {
    const next = todayKey();
    if (next !== this.today) this.today = next;
  }

  eventsForDay(date: DayKey): DayEvent[] {
    return this.byDay.get(date) ?? [];
  }

  hasEvent(date: DayKey, kind: EventKind): boolean {
    return this.eventsForDay(date).some((event) => event.kind === kind);
  }

  coversPeriod(date: DayKey): boolean {
    return periodCoversDate(this.events, date);
  }

  async addEvent(input: NewEvent): Promise<DayEvent> {
    const event: DayEvent = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    if (!this.storageBlocked) await db.putEvent(event);
    this.events = sortEvents([...this.events, event]);
    return event;
  }

  async updateEvent(event: DayEvent): Promise<void> {
    const plain = $state.snapshot(event) as DayEvent;
    if (!this.storageBlocked) await db.putEvent(plain);
    this.events = this.events.map((candidate) =>
      candidate.id === plain.id ? plain : candidate,
    );
  }

  async removeEvent(id: string): Promise<void> {
    const event = this.events.find((candidate) => candidate.id === id);
    if (!event) return;
    if (!this.storageBlocked) await db.deleteEvent(id);
    this.events = this.events.filter((candidate) => candidate.id !== id);
    this.#setUndo({ event, message: 'Event deleted' });
  }

  async undoLast(): Promise<void> {
    const state = this.undo;
    if (!state) return;
    this.#clearUndo();
    await this.restoreEvent(state.event);
  }

  dismissUndo(): void {
    this.#clearUndo();
  }

  async restoreEvent(event: DayEvent): Promise<void> {
    const plain = $state.snapshot(event) as DayEvent;
    if (!this.storageBlocked) await db.putEvent(plain);
    if (!this.events.some((candidate) => candidate.id === plain.id)) {
      this.events = sortEvents([...this.events, plain]);
    }
  }

  async markPeriodStart(date: DayKey): Promise<'created' | 'exists'> {
    if (date > this.today) throw new Error("A period can't start in the future.");
    if (this.hasEvent(date, 'period-start')) return 'exists';

    const active = this.activePeriod;
    if (active && date > active.start) {
      const end = active.hasConfirmations ? active.lastConfirmed : active.start;
      if (!this.hasEvent(end, 'period-end')) {
        await this.addEvent({ kind: 'period-end', date: end });
      }
    }
    await this.addEvent({ kind: 'period-start', date });
    return 'created';
  }

  async addPeriodDay(date: DayKey): Promise<void> {
    if (date > this.today) throw new Error("A bleeding day can't be in the future.");
    const active = this.activePeriod;
    if (!active || date < active.start) {
      throw new Error('No period is open on this day.');
    }
    if (this.hasEvent(date, 'period-day')) return;
    await this.addEvent({ kind: 'period-day', date });
  }

  async markPeriodEnd(date: DayKey): Promise<void> {
    const active = this.activePeriod;
    if (!active) throw new Error('No period is open.');
    if (date < active.start) throw new Error("The end can't be before the start.");
    if (date > this.today) throw new Error("A period can't end in the future.");
    if (this.hasEvent(date, 'period-end')) return;

    await this.addEvent({ kind: 'period-end', date });
    const laterDays = this.events.filter(
      (event) =>
        event.kind === 'period-day' && event.date > date && event.date >= active.start,
    );
    for (const event of laterDays) await this.#removeSilent(event.id);
  }

  async endActivePeriod(today: DayKey): Promise<void> {
    const end = endDateForActive(this.events, today);
    if (!end) return;
    await this.markPeriodEnd(end);
  }

  async setMood(date: DayKey, value: number): Promise<void> {
    const mood = Math.round(value);
    if (mood < 1 || mood > 5) throw new Error('Mood must be between 1 and 5.');
    const existing = this.eventsForDay(date).filter((event) => event.kind === 'mood');
    if (existing.length === 1 && existing[0]!.value === mood) return;
    for (const event of existing) await this.#removeSilent(event.id);
    await this.addEvent({ kind: 'mood', date, value: mood });
  }

  async setFlow(date: DayKey, value: 'light' | 'medium' | 'heavy'): Promise<void> {
    if (!this.coversPeriod(date)) {
      throw new Error('Flow can only be logged on a period day.');
    }
    const existing = this.eventsForDay(date).filter((event) => event.kind === 'flow');
    if (existing.length === 1 && existing[0]!.value === value) return;
    for (const event of existing) await this.#removeSilent(event.id);
    await this.addEvent({ kind: 'flow', date, value });
  }

  async addSymptom(date: DayKey, label: string): Promise<void> {
    const clean = label.trim();
    if (!clean) throw new Error('Choose a symptom first.');
    const duplicate = this.eventsForDay(date).some(
      (event) => event.kind === 'symptom' && event.label?.toLowerCase() === clean.toLowerCase(),
    );
    if (duplicate) return;
    await this.addEvent({ kind: 'symptom', date, label: clean });
  }

  async toggleIntimacy(date: DayKey): Promise<void> {
    const existing = this.eventsForDay(date).find((event) => event.kind === 'intimacy');
    if (existing) {
      await this.#removeSilent(existing.id);
      return;
    }
    await this.addEvent({ kind: 'intimacy', date });
  }

  async addNote(date: DayKey, text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) throw new Error('Write something first.');
    await this.addEvent({ kind: 'note', date, note: clean });
  }

  async addCustom(date: DayKey, text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) throw new Error('Name the event first.');
    await this.addEvent({ kind: 'custom', date, label: clean });
  }

  async updateSeverity(event: DayEvent, severity: Severity): Promise<void> {
    if (event.kind !== 'symptom' || event.severity === severity) return;
    await this.updateEvent({ ...event, severity });
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    const next = normalizeSettings({ ...this.settings, ...patch });
    if (!this.storageBlocked) await db.setMeta('settings', next);
    this.settings = next;
  }

  async importMerge(incoming: DayEvent[]): Promise<void> {
    const valid = $state.snapshot(incoming.filter(isValidEvent)) as DayEvent[];
    if (!this.storageBlocked) await db.putEvents(valid);
    this.events = mergeEvents(this.events, valid);
  }

  async importReplace(incoming: DayEvent[], settings: Settings): Promise<void> {
    const valid = $state.snapshot(incoming.filter(isValidEvent)) as DayEvent[];
    const nextSettings = normalizeSettings($state.snapshot(settings) as Settings);
    if (!this.storageBlocked) {
      await db.clearAll();
      await db.putEvents(valid);
      await db.setMeta('settings', nextSettings);
    }
    this.events = sortEvents(valid);
    this.settings = nextSettings;
  }

  async eraseAll(): Promise<void> {
    if (!this.storageBlocked) {
      await db.clearAll();
      await db.setMeta('settings', DEFAULT_SETTINGS);
    }
    this.events = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.#clearUndo();
  }

  async #removeSilent(id: string): Promise<void> {
    if (!this.storageBlocked) await db.deleteEvent(id);
    this.events = this.events.filter((event) => event.id !== id);
  }

  #setUndo(state: UndoState): void {
    this.#clearUndo();
    this.undo = {
      event: $state.snapshot(state.event) as DayEvent,
      message: state.message,
    };
    this.#undoTimer = setTimeout(() => {
      this.undo = null;
      this.#undoTimer = null;
    }, 6000);
  }

  #clearUndo(): void {
    if (this.#undoTimer) clearTimeout(this.#undoTimer);
    this.#undoTimer = null;
    this.undo = null;
  }
}

export const app = new CycalStore();
export type { ActivePeriod, CycleStats, HistoryCycle };
