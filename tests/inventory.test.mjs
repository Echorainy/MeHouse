import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInventory, validateInventory, parseCount, consumeItem, restockItem, completeMaintenance, needsRestock, needsMaintenance } from '../src/inventory.ts';
import { statistics } from '../src/domain.ts';
import { decodeSnapshot, emptySnapshot } from '../src/persistence.ts';

const consumable = { id: 'soap', name: '肥皂', roomId: 'r', categoryId: 'other', reminderDays: 7, inventoryType: 'consumable', quantity: 3, unit: '块', restockThreshold: 3 };
test('counts reject empty, fractional, negative and unsafe values', () => {
  for (const value of ['', ' ', '-1', '1.5', '1e2', '9007199254740992']) assert.equal(parseCount(value), null);
  assert.equal(parseCount('0'), 0); assert.equal(parseCount(' 12 '), 12);
  assert.ok(validateInventory({ ...consumable, restockThreshold: 0 }));
  assert.ok(validateInventory({ ...consumable, inventoryType: null }));
  assert.equal(validateInventory(consumable), null);
});
test('consume, restock and undo-as-addition use current quantity without going negative', () => {
  assert.equal(needsRestock(consumable), false);
  const used = consumeItem(consumable);
  assert.equal(used.quantity, 2); assert.equal(needsRestock(used), true);
  const replenished = restockItem(used, 4);
  assert.equal(restockItem(replenished, 1).quantity, 7);
  assert.equal(needsRestock(replenished), false);
  const empty = consumeItem(consumeItem(used));
  assert.equal(empty.quantity, 0); assert.equal(consumeItem(empty).quantity, 0);
  assert.equal(needsRestock(empty), true); assert.equal(empty.id, consumable.id);
  assert.throws(() => restockItem(empty, 0)); assert.throws(() => restockItem(empty, 0.5));
});
test('maintenance starts at the calendar window, persists overdue, and completes explicitly', () => {
  const item = { ...consumable, inventoryType: 'durable', maintenanceDate: '2026-10-10', maintenanceLeadDays: 2 };
  assert.equal(needsMaintenance(item, new Date(2026, 9, 7)), false);
  for (const day of [8, 10, 11]) assert.equal(needsMaintenance(item, new Date(2026, 9, day)), true);
  assert.equal(needsMaintenance({ ...item, quantity: 0 }, new Date(2026, 9, 10)), false);
  const done = completeMaintenance(item, undefined, new Date(2026, 9, 10));
  assert.equal(done.lastMaintenanceDate, '2026-10-10'); assert.equal(done.maintenanceDate, undefined);
  assert.equal(completeMaintenance(item, '2026-11-10').maintenanceDate, '2026-11-10');
  assert.throws(() => completeMaintenance(item, '2026-02-30'));
});
test('normalization migrates legacy records, clears incompatible fields and survives bad inventory fields', () => {
  const snapshot = emptySnapshot();
  snapshot.items = [{ id: 'legacy', name: '茶', roomId: 'kitchen', categoryId: 'drink', reminderDays: 7 }];
  const item = decodeSnapshot(JSON.stringify(snapshot)).items[0];
  assert.equal(item.quantity, 1); assert.equal(item.unit, '份'); assert.equal(item.inventoryType, null);
  assert.equal(normalizeInventory({ ...consumable, quantity: -1 }).quantity, 1);
  assert.equal(normalizeInventory({ ...consumable, maintenanceDate: '2026-10-10' }).maintenanceDate, undefined);
  assert.equal(normalizeInventory({ ...consumable, inventoryType: 'durable' }).restockThreshold, undefined);
  assert.equal(normalizeInventory({ ...consumable, inventoryType: 'durable', maintenanceDate: 'bad' }).maintenanceDate, undefined);
});
test('zero stock remains a record but does not count towards expiry alerts', () => {
  assert.deepEqual(statistics([{ ...consumable, quantity: 0, expiry: '2026-10-10' }], new Date(2026, 9, 9)), { all: 1, month: 0, week: 0, expired: 0 });
});

test('same-name records remain independent and durable items cannot be consumed', () => {
  const elsewhere = { ...consumable, id: 'other', roomId: 'elsewhere', quantity: 8 };
  const changed = [consumable, elsewhere].map(item => item.id === consumable.id ? consumeItem(item) : item);
  assert.equal(changed[0].quantity, 2); assert.equal(changed[1].quantity, 8);
  const durable = { ...consumable, inventoryType: 'durable' };
  assert.equal(consumeItem(durable), durable);
});
test('migration preserves explicit zero and round trips inventory and maintenance fields', () => {
  const snapshot = emptySnapshot();
  snapshot.items = [
    { ...consumable, quantity: 0, roomId: 'kitchen' },
    { ...consumable, id: 'durable', roomId: 'kitchen', inventoryType: 'durable', restockThreshold: undefined, maintenanceDate: '2026-10-10', maintenanceLeadDays: 0, lastMaintenanceDate: '2026-09-01' },
  ];
  const decoded = decodeSnapshot(JSON.stringify(snapshot));
  assert.equal(decoded.items[0].quantity, 0);
  assert.equal(decoded.items[1].maintenanceLeadDays, 0);
  assert.equal(decoded.items[1].lastMaintenanceDate, '2026-09-01');
  assert.deepEqual(decodeSnapshot(JSON.stringify(decoded)), decoded);
});
test('maintenance accepts zero lead time, rejects invalid dates and rolls over at midnight', () => {
  const item = { ...consumable, inventoryType: 'durable', maintenanceDate: '2026-10-10', maintenanceLeadDays: 0 };
  assert.equal(needsMaintenance(item, new Date(2026, 9, 9, 23, 59)), false);
  assert.equal(needsMaintenance(item, new Date(2026, 9, 10, 0, 0)), true);
  assert.ok(validateInventory({ ...item, maintenanceDate: '2026-02-30' }));
  assert.ok(validateInventory({ ...item, maintenanceLeadDays: -1 }));
  assert.ok(validateInventory({ ...item, maintenanceLeadDays: 1.5 }));
  assert.equal(validateInventory(item), null);
});
