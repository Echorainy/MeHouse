import test from 'node:test';
import assert from 'node:assert/strict';
import { desiredReminders, reconcileReminders } from '../src/reminder-sync.ts';

const now = new Date(2026, 9, 8, 10);
const soap = { id: 'a', name: '肥皂', quantity: 2, unit: '块', inventoryType: 'consumable', restockThreshold: 3, expiry: '2026-10-10', reminderDays: 1 };
function fixture() {
  let ledger = {}; const pending = new Map(); const delivered = [];
  const adapter = {
    permission: async () => true, read: async () => structuredClone(ledger), write: async value => { ledger = structuredClone(value); },
    pending: async () => [...pending.keys()], cancel: async id => { pending.delete(id); },
    schedule: async reminder => { if (reminder.at) pending.set(reminder.id, reminder); else delivered.push(reminder); },
  };
  return { adapter, pending, delivered, ledger: () => ledger };
}
test('restock alerts persist across reconciliations and rearm after recovery', async () => {
  const f = fixture();
  await reconcileReminders([soap], f.adapter, now);
  await reconcileReminders([{ ...soap, quantity: 1 }], f.adapter, now);
  assert.equal(f.delivered.length, 1); assert.equal(f.pending.size, 1);
  await reconcileReminders([{ ...soap, quantity: 3 }], f.adapter, now);
  await reconcileReminders([soap], f.adapter, now);
  assert.equal(f.delivered.length, 2);
});
test('denied permission does not acknowledge notifications; granting syncs pending alerts', async () => {
  const f = fixture(); f.adapter.permission = async () => false;
  await reconcileReminders([soap], f.adapter, now);
  assert.deepEqual(f.ledger(), {}); assert.equal(f.delivered.length, 0);
  f.adapter.permission = async () => true;
  await reconcileReminders([soap], f.adapter, now); assert.equal(f.delivered.length, 1);
});
test('maintenance coexists with expiry, immediately alerts inside window and cancels on completion/deletion', async () => {
  const f = fixture();
  const drill = { ...soap, inventoryType: 'durable', maintenanceDate: '2026-10-10', maintenanceLeadDays: 2 };
  await reconcileReminders([drill], f.adapter, now);
  assert.equal(f.delivered[0].kind, 'maintenance'); assert.equal(f.pending.size, 1);
  await reconcileReminders([drill], f.adapter, now); assert.equal(f.delivered.length, 1);
  await reconcileReminders([{ ...drill, maintenanceDate: '2026-11-10' }], f.adapter, now);
  assert.equal(f.pending.size, 2);
  await reconcileReminders([{ ...drill, maintenanceDate: undefined }], f.adapter, now); assert.equal(f.pending.size, 1);
  await reconcileReminders([], f.adapter, now); assert.equal(f.pending.size, 0); assert.deepEqual(f.ledger(), {});
});
test('zero quantity cancels expiry/maintenance but still allows restock and scheduling failures retry', async () => {
  const f = fixture();
  await reconcileReminders([soap], f.adapter, now);
  await reconcileReminders([{ ...soap, quantity: 0 }], f.adapter, now); assert.equal(f.pending.size, 0);
  assert.equal(desiredReminders([{ ...soap, inventoryType: 'durable', quantity: 0, maintenanceDate: '2026-10-10' }], now).length, 0);
  const failed = fixture(); const schedule = failed.adapter.schedule;
  failed.adapter.schedule = async () => { throw Error('device failure'); };
  await assert.rejects(reconcileReminders([soap], failed.adapter, now)); assert.deepEqual(failed.ledger(), {});
  failed.adapter.schedule = schedule; await reconcileReminders([soap], failed.adapter, now); assert.equal(failed.delivered.length, 1);
});
test('future maintenance uses local 9am and a delivered scheduled alert never repeats', async () => {
  const f = fixture(); const item = { ...soap, expiry: undefined, inventoryType: 'durable', maintenanceDate: '2026-10-12', maintenanceLeadDays: 2 };
  const [reminder] = desiredReminders([item], now);
  assert.equal(reminder.at.getHours(), 9); assert.equal(reminder.at.getDate(), 10);
  await reconcileReminders([item], f.adapter, now);
  f.pending.clear(); // OS delivered the scheduled notification.
  await reconcileReminders([item], f.adapter, new Date(2026, 9, 11)); assert.equal(f.delivered.length, 0);
});

test('renaming updates pending notification content without repeating delivered reminders', async () => {
  const f = fixture();
  const item = { ...soap, inventoryType: 'durable', expiry: undefined, maintenanceDate: '2026-10-12', maintenanceLeadDays: 2 };
  await reconcileReminders([item], f.adapter, now);
  await reconcileReminders([{ ...item, name: '新名字' }], f.adapter, now);
  assert.equal(f.pending.get('inventory:a:maintenance').title, '新名字 检修提醒');
  f.pending.clear();
  await reconcileReminders([{ ...item, name: '另一个名字' }], f.adapter, new Date(2026, 9, 11));
  assert.equal(f.delivered.length, 0);
});

test('a new maintenance plan inside its calendar window alerts before 9am only once', async () => {
  const item = { ...soap, inventoryType: 'durable', expiry: undefined, maintenanceDate: '2026-10-10', maintenanceLeadDays: 2 };
  const morning = new Date(2026, 9, 8, 8);
  const fresh = fixture();
  await reconcileReminders([item], fresh.adapter, morning);
  assert.equal(fresh.delivered.length, 1); assert.equal(fresh.pending.size, 0);
  await reconcileReminders([item], fresh.adapter, morning);
  assert.equal(fresh.delivered.length, 1); assert.equal(fresh.pending.size, 0);
  const existing = fixture();
  await reconcileReminders([item], existing.adapter, new Date(2026, 9, 7));
  await reconcileReminders([item], existing.adapter, morning);
  assert.equal(existing.delivered.length, 0); assert.equal(existing.pending.size, 1);
});

test('failed replacement retries even after its original delivery time', async () => {
  const f = fixture();
  const item = { ...soap, inventoryType: 'durable', expiry: undefined, maintenanceDate: '2026-10-10', maintenanceLeadDays: 2 };
  await reconcileReminders([item], f.adapter, new Date(2026, 9, 7));
  const schedule = f.adapter.schedule;
  f.adapter.schedule = async () => { throw Error('device failure'); };
  const renamed = { ...item, name: '新名字' };
  await assert.rejects(reconcileReminders([renamed], f.adapter, new Date(2026, 9, 8, 8)));
  assert.equal(f.pending.size, 0);
  f.adapter.schedule = schedule;
  await reconcileReminders([renamed], f.adapter, new Date(2026, 9, 8, 10));
  assert.equal(f.delivered.length, 1);
  assert.equal(f.delivered[0].title, '新名字 检修提醒');
  await reconcileReminders([renamed], f.adapter, new Date(2026, 9, 8, 11));
  assert.equal(f.delivered.length, 1);
});
