import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODULE_COLOR, LOCATION_TONES, MODULE_COLORS, createInitialData, isValidHexColor, moduleColorTextColor, normalizeModuleColor, remainingDays, statistics, homeItems, locationPath, validateName, directChildren, directItems, containerDescendants, removeContainerContents, removeHomeContents, filterItems, matchesCategory, removeSubcategoryAndMaybeCategory, isValidRoomLayout } from '../src/domain.ts';

const now = new Date(2026, 8, 24, 23, 59);
const dates = ['2026-09-23', '2026-09-24', '2026-10-01', '2026-10-02', '2026-10-24', '2026-10-25', undefined];
const items = dates.map((expiry, i) => ({ id: String(i), roomId: 'kitchen', categoryId: 'food', name: '茶', expiry, reminderDays: 7 }));
const homes = [{ id: 'a', name: '我的家' }, { id: 'b', name: '另一个家' }];
const rooms = [{ id: 'kitchen', homeId: 'a', name: '厨房' }, { id: 'b-kitchen', homeId: 'b', name: '厨房' }];
test('calendar boundaries include today, exclude expired from upcoming', () => {
  assert.deepEqual(dates.map(d => remainingDays(d, now)), [-1, 0, 7, 8, 30, 31, null]);
  assert.deepEqual(statistics(items, now), { all: 7, month: 4, week: 2, expired: 1 });
});
test('invalid dates and leap dates', () => {
  assert.equal(remainingDays('2026-02-30', now), null);
  assert.equal(remainingDays('2024-02-29', new Date(2024, 1, 28)), 1);
  assert.equal(remainingDays('2026-09-24', new Date(2026, 8, 25)), -1);
});
test('home filters include descendants via room and permit empty homes', () => {
  const all = [...items, { ...items[0], id: 'other', roomId: 'b-kitchen', containerId: 'drawer' }];
  assert.equal(homeItems(all, rooms, 'a').length, 7);
  assert.equal(homeItems(all, rooms, 'b').length, 1);
  assert.equal(homeItems(all, [], 'a').length, 0);
});
test('paths distinguish homes and children never leak into parent level', () => {
  const modules = [{ id: 'cabinet', roomId: 'kitchen', name: '橱柜' }, { id: 'drawer', roomId: 'kitchen', parentId: 'cabinet', name: '抽屉' }];
  assert.equal(locationPath('kitchen', 'drawer', homes, rooms, modules), '我的家 → 厨房 → 橱柜 → 抽屉');
  assert.equal(locationPath('b-kitchen', undefined, homes, rooms, modules), '另一个家 → 厨房');
  assert.deepEqual(directChildren(modules, 'kitchen', undefined).map(x => x.id), ['cabinet']);
  assert.deepEqual(directChildren(modules, 'kitchen', 'cabinet').map(x => x.id), ['drawer']);
  assert.equal(directItems([{ ...items[0], containerId: 'drawer' }], 'kitchen', undefined).length, 0);
});
test('trimmed names must be unique in their scope', () => {
  assert.ok(validateName('  ', homes));
  assert.ok(validateName(' 我的家 ', homes));
  assert.equal(validateName(' 我的家 ', homes, 'a'), null);
  assert.equal(validateName('新家', homes), null);
});
test('container descendants include nested modules and remove their items', () => {
  const containers = [
    { id: 'cabinet', roomId: 'r', name: '柜子', level: 2, cells: [] },
    { id: 'drawer', roomId: 'r', name: '抽屉', parentId: 'cabinet', level: 3, cells: [] },
  ];
  const items = [
    { id: 'a', roomId: 'r', containerId: 'cabinet', categoryId: 'other', name: 'A', reminderDays: 7 },
    { id: 'b', roomId: 'r', containerId: 'drawer', categoryId: 'other', name: 'B', reminderDays: 7 },
    { id: 'c', roomId: 'r', categoryId: 'other', name: 'C', reminderDays: 7 },
  ];
  assert.deepEqual(containerDescendants(containers, 'cabinet').map(c => c.id), ['cabinet', 'drawer']);
  const result = removeContainerContents(containers, items, 'cabinet');
  assert.deepEqual(result.containers, []);
  assert.deepEqual(result.items.map(i => i.id), ['c']);
});

test('module colors expose the eight warm muted presets', () => {
  assert.deepEqual(MODULE_COLORS, [
    '#D6B59A', '#C98F7A', '#C9A0A0', '#D2AAA0',
    '#A3AD96', '#A59D7A', '#D4BE8D', '#B4A393',
  ]);
  assert.equal(DEFAULT_MODULE_COLOR, '#A3AD96');
});

test('module colors normalize valid hex and reject invalid values', () => {
  assert.equal(isValidHexColor('#C98F7A'), true);
  assert.equal(isValidHexColor('#c98f7a'), true);
  assert.equal(normalizeModuleColor('  #c98f7a '), '#C98F7A');
  for (const value of ['', 'C98F7A', '#FFF', '#GGGGGG', '#1234567']) {
    assert.equal(isValidHexColor(value), false);
    assert.equal(normalizeModuleColor(value), DEFAULT_MODULE_COLOR);
  }
});

test('module colors choose readable text contrast', () => {
  assert.equal(moduleColorTextColor('#C98F7A'), '#242C2A');
  assert.equal(moduleColorTextColor('#463B32'), '#FFFDF8');
  assert.equal(moduleColorTextColor(undefined), '#242C2A');
});

test('location tones provide distinct soft colors for each placement level', () => {
  assert.deepEqual(LOCATION_TONES.neutral, { background: '#F1E4B8', border: '#B5A56E', text: '#665A32' });
  assert.deepEqual(LOCATION_TONES.room, { background: '#D8E3D2', border: '#7F987A', text: '#50634D' });
  assert.deepEqual(LOCATION_TONES.module, { background: '#D2DEE5', border: '#7893A2', text: '#4E6572' });
  assert.deepEqual(LOCATION_TONES.submodule, { background: '#E6D2D0', border: '#AC8584', text: '#704F50' });
});

test('initial directly placed items have no grid cell', () => {
  const initial = createInitialData();
  const directItems = initial.items.filter(item => !item.containerId);
  assert.ok(directItems.length > 0);
  assert.ok(directItems.every(item => !('cell' in item)));
});

test('initial data includes food and clothing subcategories', () => {
  const initial = createInitialData();
  assert.equal(initial.categories.find(category => category.id === 'food')?.name, '食物');
  assert.equal(initial.categories.find(category => category.id === 'clothes')?.name, '衣物');
  assert.deepEqual(initial.subcategories.filter(subcategory => subcategory.parentCategoryId === 'food').map(subcategory => subcategory.name), ['主食', '蔬菜', '水果', '零食', '饮料', '肉类']);
  assert.deepEqual(initial.subcategories.filter(subcategory => subcategory.parentCategoryId === 'clothes').map(subcategory => subcategory.name), ['上衣', '下衣', '连体', '配饰']);
  assert.ok(initial.categories.filter(category => category.id !== 'uncategorized').every(category => category.allowSubcategories));
  assert.equal(initial.categories.find(category => category.id === 'uncategorized')?.allowSubcategories, false);
});

test('room layouts accept integer dimensions from 6 through 12 only', () => {
  assert.equal(isValidRoomLayout({ rows: 6, cols: 12 }), true);
  assert.equal(isValidRoomLayout({ rows: 8, cols: 8 }), true);
  assert.equal(isValidRoomLayout({ rows: 12, cols: 6 }), true);
  for (const layout of [{ rows: 5, cols: 8 }, { rows: 8, cols: 13 }, { rows: 6.5, cols: 8 }, { rows: 8, cols: 0 }]) {
    assert.equal(isValidRoomLayout(layout), false);
  }
});

test('removing a home removes only its rooms, modules, and items', () => {
  const data = { homes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rooms: [{ id: 'ar', homeId: 'a' }, { id: 'br', homeId: 'b' }], containers: [{ id: 'ac', roomId: 'ar' }, { id: 'bc', roomId: 'br' }], items: [{ id: 'ai', roomId: 'ar' }, { id: 'bi', roomId: 'br' }] };
  assert.deepEqual(removeHomeContents(data, 'a'), { homes: [{ id: 'b', name: 'B' }], rooms: [{ id: 'br', homeId: 'b' }], containers: [{ id: 'bc', roomId: 'br' }], items: [{ id: 'bi', roomId: 'br' }] });
  assert.equal(removeHomeContents({ ...data, homes: [data.homes[0]] }, 'a', true).error, '至少保留一个家');
});

test('category filters combine with expiry filters', () => {
  assert.equal(matchesCategory({ categoryId: 'drink' }, 'drink'), true);
  assert.equal(matchesCategory({ categoryId: 'drink' }, 'food'), false);
  assert.equal(matchesCategory({ categoryId: 'drink' }, undefined), true);
  const sample = [
    { id: 'a', categoryId: 'drink', expiry: '2026-09-24' },
    { id: 'b', categoryId: 'drink', expiry: '2026-10-01' },
    { id: 'c', categoryId: 'food', expiry: '2026-09-23' },
  ];
  assert.deepEqual(filterItems(sample, 'all', 'drink', now).map(i => i.id), ['a', 'b']);
  assert.deepEqual(filterItems(sample, 'week', 'drink', now).map(i => i.id), ['a', 'b']);
  assert.deepEqual(filterItems(sample, 'expired', undefined, now).map(i => i.id), ['c']);
});

test('subcategory filters match the selected parent and child', () => {
  const sample = [
    { id: 'a', categoryId: 'food', subcategoryId: 'snacks', expiry: '2026-09-24' },
    { id: 'b', categoryId: 'food', subcategoryId: 'fruit', expiry: '2026-10-01' },
    { id: 'c', categoryId: 'clothes', subcategoryId: 'tops', expiry: '2026-09-23' },
  ];
  assert.deepEqual(filterItems(sample, 'all', 'food', now, 'snacks').map(i => i.id), ['a']);
  assert.deepEqual(filterItems(sample, 'all', 'food', now, 'missing').map(i => i.id), []);
  assert.deepEqual(filterItems(sample, 'all', 'food', now).map(i => i.id), ['a', 'b']);
});

test('deleting the last clothing subcategory removes clothing and reclassifies its items', () => {
  const result = removeSubcategoryAndMaybeCategory(
    [{ id: 'clothes', name: '衣物', isSystem: false }, { id: 'food', name: '食物', isSystem: false }, { id: 'uncategorized', name: '未分类', isSystem: true }],
    [{ id: 'top', name: '上衣', parentCategoryId: 'clothes' }],
    [{ id: 'a', categoryId: 'clothes', subcategoryId: 'top' }, { id: 'b', categoryId: 'food' }],
    'top',
  );
  assert.deepEqual(result.categories.map(category => category.id), ['food', 'uncategorized']);
  assert.deepEqual(result.subcategories, []);
  assert.deepEqual(result.items, [{ id: 'a', categoryId: 'uncategorized' }, { id: 'b', categoryId: 'food' }]);
});

test('deleting a non-clothing last subcategory keeps its parent category', () => {
  const result = removeSubcategoryAndMaybeCategory(
    [{ id: 'food', name: '食物', isSystem: false }, { id: 'uncategorized', name: '未分类', isSystem: true }],
    [{ id: 'fruit', name: '水果', parentCategoryId: 'food' }],
    [{ id: 'a', categoryId: 'food', subcategoryId: 'fruit' }],
    'fruit',
  );
  assert.deepEqual(result.categories.map(category => category.id), ['food', 'uncategorized']);
  assert.deepEqual(result.subcategories, []);
  assert.deepEqual(result.items, [{ id: 'a', categoryId: 'food' }]);
});
