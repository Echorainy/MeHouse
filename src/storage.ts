import type { ReminderLedger } from './reminder-sync';
import * as SQLite from 'expo-sqlite';
import { Snapshot, decodeSnapshot, emptySnapshot, encodeSnapshot } from './persistence';
import { removeItemImage } from './item-image';

const DB_NAME = 'home-whereabouts.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;
async function database() { databasePromise ??= SQLite.openDatabaseAsync(DB_NAME); return databasePromise; }
export async function loadSnapshot(): Promise<Snapshot> {
  const db = await database();
  await db.execAsync('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, snapshot TEXT NOT NULL, updated_at TEXT NOT NULL);');
  const row = await db.getFirstAsync<{ snapshot: string }>('SELECT snapshot FROM app_state WHERE id = 1');
  if (!row?.snapshot) return emptySnapshot();
  try { return decodeSnapshot(row.snapshot); } catch { return emptySnapshot(); }
}
export async function saveSnapshot(snapshot: Snapshot) {
  const db = await database();
  const previous = await db.getFirstAsync<{ snapshot: string }>('SELECT snapshot FROM app_state WHERE id = 1');
  await db.runAsync('INSERT OR REPLACE INTO app_state (id, snapshot, updated_at) VALUES (1, ?, ?)', encodeSnapshot(snapshot), new Date().toISOString());
  // Delete only after the new snapshot is durable; also covers room/home/module deletion.
  if (previous) {
    try {
      const retained = new Set(snapshot.items.map(item => item.imageUri));
      const obsolete = new Set(decodeSnapshot(previous.snapshot).items.map(item => item.imageUri).filter(uri => uri && !retained.has(uri)));
      await Promise.all([...obsolete].map(uri => removeItemImage(uri).catch(() => undefined)));
    } catch { /* Never turn a cleanup failure into loss of a successfully saved snapshot. */ }
  }
}

export async function loadReminderLedger(): Promise<ReminderLedger> {
  const db = await database();
  await db.execAsync('CREATE TABLE IF NOT EXISTS reminder_state (id INTEGER PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM reminder_state WHERE id = 1');
  const value = JSON.parse(row?.value ?? '{}');
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export async function saveReminderLedger(value: ReminderLedger) {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO reminder_state (id, value) VALUES (1, ?)', JSON.stringify(value));
}
