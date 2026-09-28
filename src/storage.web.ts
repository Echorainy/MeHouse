import type { ReminderLedger } from './reminder-sync';
import { Snapshot, decodeSnapshot, emptySnapshot, encodeSnapshot } from './persistence';

const STORAGE_KEY = 'home-whereabouts.snapshot';

export async function loadSnapshot(): Promise<Snapshot> {
  try {
    return decodeSnapshot(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '');
  } catch {
    return emptySnapshot();
  }
}

export async function saveSnapshot(snapshot: Snapshot) {
  globalThis.localStorage?.setItem(STORAGE_KEY, encodeSnapshot(snapshot));
}

export async function loadReminderLedger(): Promise<ReminderLedger> {
  const value = JSON.parse(globalThis.localStorage?.getItem('home-whereabouts.reminders') ?? '{}');
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export async function saveReminderLedger(value: ReminderLedger) {
  globalThis.localStorage?.setItem('home-whereabouts.reminders', JSON.stringify(value));
}
