import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DayEvent } from './types';

interface CycalDB extends DBSchema {
  events: {
    key: string;
    value: DayEvent;
    indexes: { by_date: string };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<CycalDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<CycalDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CycalDB>('cycal', 1, {
      upgrade(db) {
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('by_date', 'date');
        db.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

export async function getAllEvents(): Promise<DayEvent[]> {
  const db = await getDb();
  return db.getAll('events');
}

export async function putEvent(event: DayEvent): Promise<void> {
  const db = await getDb();
  await db.put('events', event);
}

export async function putEvents(events: DayEvent[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('events', 'readwrite');
  await Promise.all(events.map((event) => tx.store.put(event)));
  await tx.done;
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('events', id);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('meta', value, key);
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['events', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('events').clear(), tx.objectStore('meta').clear()]);
  await tx.done;
}
