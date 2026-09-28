import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileReminders } from '../src/reminder-sync.ts';
import { reminderDate } from '../src/notification-date.ts';

test('calculates reminder date from expiry and per-item lead days', () => {
  assert.equal(reminderDate('2026-10-10', 7), '2026-10-03');
  assert.equal(reminderDate('2024-03-01', 1), '2024-02-29');
  assert.equal(reminderDate(undefined, 7), null);
  assert.equal(reminderDate('bad-date', 7), null);
});

// Execute the notification boundary with native dependencies replaced: loading the
// native library in Expo Go reproduces the device's startup failure.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadNotifications(expoGo, platform = 'android', dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/notifications.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, require(name) {
    if (name in dependencies) return dependencies[name];
    if (name === 'expo') return { isRunningInExpoGo: () => expoGo };
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === './notification-date') return { reminderDate };
    if (name === 'expo-notifications') throw new Error('Native notifications loaded in unsupported runtime');
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

for (const [label, expoGo, platform] of [['Expo Go', true, 'android'], ['web', false, 'web']]) {
  test(`${label} can load and use reminder helpers without loading native notifications`, async () => {
    const api = loadNotifications(expoGo, platform);
    assert.equal(await api.requestNotificationPermission(), false);
    await api.rescheduleAllReminders([{ id: 'test' }]);
    assert.equal(await api.initializeNotifications(), false);
  });
}

test('native boundary schedules distinct identifiers and persists successful acknowledgements', async () => {
  let ledger = {}; const requests = new Map(); let scheduled = 0;
  const native = {
    getPermissionsAsync: async () => ({ granted: true }),
    getAllScheduledNotificationsAsync: async () => [...requests.values()],
    scheduleNotificationAsync: async request => { scheduled++; requests.set(request.identifier, request); return request.identifier; },
    cancelScheduledNotificationAsync: async id => { requests.delete(id); },
    dismissNotificationAsync: async () => undefined,
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
  const api = loadNotifications(false, 'android', {
    './reminder-sync': { reconcileReminders },
    './storage': { loadReminderLedger: async () => structuredClone(ledger), saveReminderLedger: async value => { ledger = structuredClone(value); } },
    'expo-notifications': native,
  });
  const item = { id: 'device', name: '设备', quantity: 1, unit: '台', inventoryType: 'durable', expiry: '2099-10-10', reminderDays: 7, maintenanceDate: '2099-11-10', maintenanceLeadDays: 3 };
  await Promise.all([api.rescheduleAllReminders([item]), api.rescheduleAllReminders([item])]);
  assert.equal(scheduled, 2);
  assert.equal(requests.get('inventory:device:maintenance').content.data.kind, 'maintenance');
  assert.equal(requests.get('inventory:device:maintenance').trigger.channelId, 'inventory');
  assert.equal(requests.get('inventory:device:maintenance').trigger.date.getHours(), 9);
  await api.rescheduleAllReminders([]);
  assert.equal(requests.size, 0); assert.deepEqual(ledger, {});
});
