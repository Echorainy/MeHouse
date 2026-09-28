import type { Item } from './domain.ts';
import { needsRestock } from './inventory.ts';
import { reminderDate } from './notification-date.ts';

export type Reminder = { id: string; itemId: string; kind: 'expiry' | 'restock' | 'maintenance'; fingerprint: string; title: string; body: string; at: Date | null };
export type ReminderLedger = Record<string, { fingerprint: string; content: string; scheduledAt: string | null }>;
export type ReminderAdapter = {
  permission(): Promise<boolean>; read(): Promise<ReminderLedger>; write(ledger: ReminderLedger): Promise<void>;
  pending(): Promise<string[]>; cancel(id: string): Promise<void>; schedule(reminder: Reminder): Promise<void>;
};
export function desiredReminders(items: Item[], now = new Date()): Reminder[] {
  return items.flatMap(item => {
    const result: Reminder[] = [];
    if (needsRestock(item)) result.push({ id: `inventory:${item.id}:restock`, itemId: item.id, kind: 'restock', fingerprint: 'low', title: `${item.name} 需要补货`, body: `剩余 ${item.quantity} ${item.unit}，库存线 ${item.restockThreshold} ${item.unit}`, at: null });
    if (item.quantity === 0) return result;
    for (const kind of ['expiry', 'maintenance'] as const) {
      const date = kind === 'expiry' ? item.expiry : item.inventoryType === 'durable' ? item.maintenanceDate : undefined;
      const lead = kind === 'expiry' ? item.reminderDays : item.maintenanceLeadDays ?? 7;
      const reminder = reminderDate(date, lead);
      if (!reminder) continue;
      const at = new Date(`${reminder}T09:00:00`);
      result.push({ id: `inventory:${item.id}:${kind}`, itemId: item.id, kind, fingerprint: `${date}:${lead}`, title: `${item.name} ${kind === 'expiry' ? '到期提醒' : '检修提醒'}`, body: `${kind === 'expiry' ? '过期日期' : '检修日期'}：${date}`, at: at > now ? at : null });
    }
    return result;
  });
}
// Caller serializes reconciliations: persist each successful request before continuing.
export async function reconcileReminders(items: Item[], adapter: ReminderAdapter, now = new Date()) {
  const ledger = await adapter.read();
  const desired = desiredReminders(items, now);
  const byId = new Map(desired.map(reminder => [reminder.id, reminder]));
  const pending = new Set(await adapter.pending());
  for (const id of new Set([...Object.keys(ledger), ...pending])) {
    const reminder = byId.get(id);
    if (!reminder || (ledger[id] && ledger[id].fingerprint !== reminder.fingerprint)) {
      await adapter.cancel(id); pending.delete(id); delete ledger[id];
    }
  }
  await adapter.write(ledger);
  if (!await adapter.permission()) return;
  for (const reminder of desired) {
    const previous = ledger[reminder.id];
    const content = JSON.stringify([reminder.title, reminder.body]);
    if (previous?.fingerprint === reminder.fingerprint && (previous.scheduledAt === null || !reminder.at || (pending.has(reminder.id) && previous.content === content))) continue;
    // Newly created plans inside today's window notify now; previously scheduled
    // plans keep their 9am delivery. Renames only replace still-pending content.
    const at = !previous && reminder.kind === 'maintenance' && reminder.at?.toDateString() === now.toDateString() ? null : reminder.at;
    if (pending.has(reminder.id)) {
      // A failed replacement must remain eligible for retry after 9am too.
      delete ledger[reminder.id];
      await adapter.write(ledger);
      await adapter.cancel(reminder.id);
      pending.delete(reminder.id);
    }
    await adapter.schedule({ ...reminder, at });
    ledger[reminder.id] = { fingerprint: reminder.fingerprint, content, scheduledAt: at?.toISOString() ?? null };
    await adapter.write(ledger);
  }
}
