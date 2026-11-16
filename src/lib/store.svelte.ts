import { addDays, todayKey } from './date';
import { computeHistory, computeStats } from './cycle';
import {
  endDateForActive,
  findActivePeriod,
  periodBlocks,
  periodCoversDate,
  periodRangeIssue,
  type PeriodRangeIssue,
} from './periods';
import * as db from './db';
import { isValidEvent, mergeEvents } from './backup';
import { COPY } from './strings';
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

function isPeriodEvent(kind: EventKind): boolean {
  return kind === 'period-start' || kind === 'period-day' || kind === 'period-end';
}

function periodRangeError(issue: Exclude<PeriodRangeIssue, null>): Error {
  switch (issue) {
    case 'invalid':
      return new Error(COPY.errors.periodInvalid);
    case 'future':
      return new Error(COPY.errors.periodFuture);
    case 'endFuture':
      return new Error(COPY.errors.periodEndFuture);
    case 'backwards':
      return new Error(COPY.errors.periodBackwards);
    case 'overlap':
      return new Error(COPY.errors.periodOverlap);
    case 'afterNext':
      return new Error(COPY.errors.periodAfterNext);
    case 'order':
      return new Error(COPY.errors.periodOrder);
    case 'openActive':
      return new Error(COPY.errors.periodActive);
    case 'openNotLatest':
      return new Error(COPY.errors.periodOpenNotLatest);
  }
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
    this.#setUndo({ event, message: COPY.sheet.undoMessage });
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
    if (date > this.today) throw new Error(COPY.errors.futureStart);
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
    if (date > this.today) throw new Error(COPY.errors.futureBleeding);
    const active = this.activePeriod;
    if (!active || date < active.start) {
      throw new Error(COPY.errors.noOpenPeriodDay);
    }
    if (this.hasEvent(date, 'period-day')) return;
    await this.addEvent({ kind: 'period-day', date });
  }

  async markPeriodEnd(date: DayKey): Promise<void> {
    const active = this.activePeriod;
    if (!active) throw new Error(COPY.errors.noOpenPeriod);
    if (date < active.start) throw new Error(COPY.errors.endBeforeStart);
    if (date > this.today) throw new Error(COPY.errors.futureEnd);
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

  async addPeriodRange(start: DayKey, end: DayKey): Promise<void> {
    const issue = periodRangeIssue(this.events, start, end, this.today);
    if (issue) throw periodRangeError(issue);
    this.#clearUndo();
    await this.addEvent({ kind: 'period-start', date: start });
    await this.addEvent({ kind: 'period-end', date: end });
  }

  async updatePeriodRange(
    originalStart: DayKey,
    start: DayKey,
    end: DayKey | null,
  ): Promise<void> {
    const block = periodBlocks(this.events).find((candidate) => candidate.start === originalStart);
    if (!block) throw new Error(COPY.errors.periodNotFound);
    const issue = periodRangeIssue(this.events, start, end, this.today, originalStart);
    if (issue) throw periodRangeError(issue);
    this.#clearUndo();
    const oldEvents = this.events.filter(
      (event) =>
        isPeriodEvent(event.kind) &&
        event.date >= block.start &&
        event.date <= block.lastConfirmed,
    );
    for (const event of oldEvents) await this.#removeSilent(event.id);
    await this.addEvent({ kind: 'period-start', date: start });
    if (end) await this.addEvent({ kind: 'period-end', date: end });
  }

  async deletePeriodRange(originalStart: DayKey): Promise<void> {
    const block = periodBlocks(this.events).find((candidate) => candidate.start === originalStart);
    if (!block) throw new Error(COPY.errors.periodNotFound);
    this.#clearUndo();
    const oldEvents = this.events.filter(
      (event) =>
        isPeriodEvent(event.kind) &&
        event.date >= block.start &&
        event.date <= block.lastConfirmed,
    );
    for (const event of oldEvents) await this.#removeSilent(event.id);
  }

  async setMood(date: DayKey, value: number): Promise<void> {
    const mood = Math.round(value);
    if (mood < 1 || mood > 5) throw new Error(COPY.errors.moodRange);
    const existing = this.eventsForDay(date).filter((event) => event.kind === 'mood');
    if (existing.length === 1 && existing[0]!.value === mood) return;
    for (const event of existing) await this.#removeSilent(event.id);
    await this.addEvent({ kind: 'mood', date, value: mood });
  }

  async setFlow(date: DayKey, value: 'light' | 'medium' | 'heavy'): Promise<void> {
    if (!this.coversPeriod(date)) {
      throw new Error(COPY.errors.flowOnlyPeriod);
    }
    const existing = this.eventsForDay(date).filter((event) => event.kind === 'flow');
    if (existing.length === 1 && existing[0]!.value === value) return;
    for (const event of existing) await this.#removeSilent(event.id);
    await this.addEvent({ kind: 'flow', date, value });
  }

  async addSymptom(date: DayKey, label: string): Promise<void> {
    const clean = label.trim();
    if (!clean) throw new Error(COPY.errors.chooseSymptom);
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
    if (!clean) throw new Error(COPY.errors.writeText);
    await this.addEvent({ kind: 'note', date, note: clean });
  }

  async addCustom(date: DayKey, text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) throw new Error(COPY.errors.nameEvent);
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
