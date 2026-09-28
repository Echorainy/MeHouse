import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSnapshot, encodeSnapshot, emptySnapshot, migrateSnapshot } from '../src/persistence.ts';
import { DEFAULT_MODULE_COLOR, normalizeModuleColor } from '../src/domain.ts';

test('encodes and decodes all app collections without losing nested layout data', () => {
  const input = { homes: [{ id: 'h', name: '我的家', greeting: '今天也要把家照顾好', note: '喵今天好好收纳了吗' }], rooms: [{ id: 'r', homeId: 'h', name: '厨房', layout: { rows: 8, cols: 8 } }], containers: [{ id: 'c', roomId: 'r', name: '橱柜', level: 3, cells: [1, 2] }], items: [{ id: 'i', name: '茶', quantity: 1, unit: '份', inventoryType: null, roomId: 'r', categoryId: 'drink', subcategoryId: 'tea', containerId: 'c', cell: 1, expiry: '2026-09-24', reminderDays: 7 }], categories: [{ id: 'drink', name: '饮品', isSystem: false, allowSubcategories: true }], subcategories: [{ id: 'tea', name: '茶', parentCategoryId: 'drink' }] };
  assert.deepEqual(decodeSnapshot(encodeSnapshot(input)), input);
});

test('accepts custom room dimensions while preserving layout data', () => {
  const snapshot = decodeSnapshot(JSON.stringify({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 6, cols: 12 } }],
    containers: [], items: [], categories: [], subcategories: [],
  }));
  assert.deepEqual(snapshot.rooms[0].layout, { rows: 6, cols: 12 });
});

test('migrates old snapshots with food and clothing defaults', () => {
  const snapshot = decodeSnapshot(JSON.stringify({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [],
    items: [{ id: 'i', name: '苹果', roomId: 'r', categoryId: 'food', reminderDays: 7 }],
    categories: [{ id: 'food', name: '食品', isSystem: false }],
  }));
  assert.equal(snapshot.categories.find(category => category.id === 'food')?.name, '食物');
  assert.equal(snapshot.categories.find(category => category.id === 'clothes')?.name, '衣物');
  assert.deepEqual(snapshot.subcategories.filter(subcategory => subcategory.parentCategoryId === 'clothes').map(subcategory => subcategory.name), ['上衣', '下衣', '连体', '配饰']);
  assert.equal(snapshot.items[0].subcategoryId, undefined);
});

test('migrates category child capability and preserves existing children', () => {
  const snapshot = decodeSnapshot(JSON.stringify({
    homes: [{ id: 'h', name: '家' }], rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }], containers: [], items: [],
    categories: [
      { id: 'custom', name: '自定义', isSystem: false },
      { id: 'locked', name: '已有子类', isSystem: false, allowSubcategories: false },
      { id: 'uncategorized', name: '未分类', isSystem: true },
    ],
    subcategories: [
      { id: 'child', name: '子类', parentCategoryId: 'locked' },
      { id: 'invalid', name: '非法', parentCategoryId: 'uncategorized' },
    ],
  }));
  assert.equal(snapshot.categories.find(category => category.id === 'custom')?.allowSubcategories, true);
  assert.equal(snapshot.categories.find(category => category.id === 'locked')?.allowSubcategories, true);
  assert.equal(snapshot.categories.find(category => category.id === 'uncategorized')?.allowSubcategories, false);
  assert.deepEqual(snapshot.subcategories.map(subcategory => subcategory.id), ['child']);
});

test('clears subcategory references that do not belong to the item category', () => {
  const snapshot = decodeSnapshot(JSON.stringify({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [],
    items: [{ id: 'i', name: '苹果', roomId: 'r', categoryId: 'food', subcategoryId: 'tops', reminderDays: 7 }],
    categories: [{ id: 'food', name: '食物', isSystem: false }, { id: 'clothes', name: '衣物', isSystem: false }],
    subcategories: [{ id: 'tops', name: '上衣', parentCategoryId: 'clothes' }],
  }));
  assert.equal(snapshot.items[0].subcategoryId, undefined);
});

test('removes an empty clothing category while preserving clothing with children', () => {
  const empty = decodeSnapshot(JSON.stringify({
    homes: [{ id: 'h', name: '家' }], rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }], containers: [],
    items: [{ id: 'i', name: '衣服', roomId: 'r', categoryId: 'clothes', reminderDays: 7 }],
    categories: [{ id: 'clothes', name: '衣物', isSystem: false }, { id: 'uncategorized', name: '未分类', isSystem: true }], subcategories: [],
  }));
  assert.equal(empty.categories.some(category => category.id === 'clothes'), false);
  assert.equal(empty.items[0].categoryId, 'uncategorized');
  const populated = decodeSnapshot(JSON.stringify({
    homes: [{ id: 'h', name: '家' }], rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }], containers: [], items: [],
    categories: [{ id: 'clothes', name: '衣物', isSystem: false }], subcategories: [{ id: 'top', name: '上衣', parentCategoryId: 'clothes' }],
  }));
  assert.equal(populated.categories.some(category => category.id === 'clothes'), true);
});

test('migrates missing or corrupt snapshots to safe initial data', () => {
  const initial = emptySnapshot();
  assert.deepEqual(migrateSnapshot(undefined), initial);
  assert.deepEqual(migrateSnapshot('{"homes":[]}'), initial);
  assert.deepEqual(migrateSnapshot('{broken'), initial);
  assert.deepEqual(migrateSnapshot('{"rooms":[{"id":"r"}]}').rooms, initial.rooms);
});

test('normalizes duplicate module cells when loading snapshots', () => {
  const snapshot = encodeSnapshot({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [{ id: 'c', roomId: 'r', name: '模块', level: 2, cells: [4, 4, 5] }],
    items: [],
    categories: [],
  });
  assert.deepEqual(decodeSnapshot(snapshot).containers[0].cells, [4, 5]);
});

test('old snapshots without module colors remain readable with the default color', () => {
  const snapshot = decodeSnapshot(encodeSnapshot({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [{ id: 'c', roomId: 'r', name: '模块', level: 2, cells: [] }],
    items: [],
    categories: [],
  }));
  assert.equal(normalizeModuleColor(snapshot.containers[0].color), DEFAULT_MODULE_COLOR);
});

test('old snapshots without home copy use default greeting and note', () => {
  const snapshot = decodeSnapshot(JSON.stringify({ homes: [{ id: 'h', name: '家' }], rooms: [], containers: [], items: [], categories: [] }));
  assert.equal(snapshot.homes[0].greeting, '今天也要把家照顾好');
  assert.equal(snapshot.homes[0].note, '喵今天好好收纳了吗');
});

test('directly placed items discard legacy grid cells while module items keep theirs', () => {
  const snapshot = decodeSnapshot(encodeSnapshot({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [{ id: 'c', roomId: 'r', name: '模块', level: 3, cells: [1] }],
    items: [
      { id: 'direct', name: '直接物品', roomId: 'r', categoryId: 'other', cell: 5, reminderDays: 7 },
      { id: 'nested', name: '模块物品', roomId: 'r', containerId: 'c', categoryId: 'other', cell: 6, reminderDays: 7 },
    ],
    categories: [],
  }));
  assert.equal('cell' in snapshot.items[0], false);
  assert.equal(snapshot.items[1].cell, 6);
});

test('second-level module items discard legacy grid cells while third-level items keep theirs', () => {
  const snapshot = decodeSnapshot(encodeSnapshot({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [
      { id: 'cabinet', roomId: 'r', name: '橱柜', level: 2, cells: [1] },
      { id: 'drawer', roomId: 'r', name: '抽屉', parentId: 'cabinet', level: 3, cells: [2] },
    ],
    items: [
      { id: 'cabinet-item', name: '橱柜物品', roomId: 'r', containerId: 'cabinet', categoryId: 'other', cell: 5, reminderDays: 7 },
      { id: 'drawer-item', name: '抽屉物品', roomId: 'r', containerId: 'drawer', categoryId: 'other', cell: 6, reminderDays: 7 },
    ],
    categories: [],
    subcategories: [],
  }));
  assert.equal('cell' in snapshot.items[0], false);
  assert.equal(snapshot.items[1].cell, 6);
});
