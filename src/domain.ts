import type { InventoryFields } from './inventory.ts';
export type Home = { id: string; name: string; greeting?: string; note?: string };
export const DEFAULT_HOME_GREETING = '今天也要把家照顾好';
export const DEFAULT_HOME_NOTE = '喵今天好好收纳了吗';
export type RoomLayout = { rows: number; cols: number };
export type Room = { id: string; homeId: string; name: string; layout: RoomLayout };
export const ROOM_DIMENSION_MIN = 6;
export const ROOM_DIMENSION_MAX = 12;
export const ROOM_SIZE_PRESETS = [6, 8, 10, 12] as const;
export function isValidRoomLayout(layout: RoomLayout | undefined): boolean {
  return !!layout && Number.isInteger(layout.rows) && Number.isInteger(layout.cols)
    && layout.rows >= ROOM_DIMENSION_MIN && layout.rows <= ROOM_DIMENSION_MAX
    && layout.cols >= ROOM_DIMENSION_MIN && layout.cols <= ROOM_DIMENSION_MAX;
}
export type Container = { id: string; name: string; roomId: string; parentId?: string; level: 2 | 3; cells: number[]; color?: string };
export type Item = InventoryFields & { id: string; name: string; roomId: string; containerId?: string; categoryId: string; subcategoryId?: string; cell?: number; expiry?: string; reminderDays: number };
export type Category = { id: string; name: string; isSystem: boolean; allowSubcategories: boolean };
export type Subcategory = { id: string; name: string; parentCategoryId: string };
export type Location = { roomId: string; containerId?: string };
export type LocationTone = 'neutral' | 'room' | 'module' | 'submodule';
export const LOCATION_TONES: Record<LocationTone, { background: string; border: string; text: string }> = {
  neutral: { background: '#F1E4B8', border: '#B5A56E', text: '#665A32' },
  room: { background: '#D8E3D2', border: '#7F987A', text: '#50634D' },
  module: { background: '#D2DEE5', border: '#7893A2', text: '#4E6572' },
  submodule: { background: '#E6D2D0', border: '#AC8584', text: '#704F50' },
};
export type Filter = 'all' | 'month' | 'week' | 'expired';
export const filterLabels: Record<Filter, string> = { all: '全部物品', month: '30 天内过期', week: '7 天内过期', expired: '已过期' };
export const MODULE_COLORS = ['#D6B59A', '#C98F7A', '#C9A0A0', '#D2AAA0', '#A3AD96', '#A59D7A', '#D4BE8D', '#B4A393'] as const;
export const DEFAULT_MODULE_COLOR = '#A3AD96';
export const DEFAULT_SUBCATEGORIES: ReadonlyArray<Subcategory> = [
  { id: 'food-staple', name: '主食', parentCategoryId: 'food' },
  { id: 'food-vegetable', name: '蔬菜', parentCategoryId: 'food' },
  { id: 'food-fruit', name: '水果', parentCategoryId: 'food' },
  { id: 'food-snack', name: '零食', parentCategoryId: 'food' },
  { id: 'food-drink', name: '饮料', parentCategoryId: 'food' },
  { id: 'food-meat', name: '肉类', parentCategoryId: 'food' },
  { id: 'clothes-top', name: '上衣', parentCategoryId: 'clothes' },
  { id: 'clothes-bottom', name: '下衣', parentCategoryId: 'clothes' },
  { id: 'clothes-one-piece', name: '连体', parentCategoryId: 'clothes' },
  { id: 'clothes-accessory', name: '配饰', parentCategoryId: 'clothes' },
];
export function isValidHexColor(value: string) { return /^#[0-9A-Fa-f]{6}$/.test(value.trim()); }
export function normalizeModuleColor(value?: string) { return value && isValidHexColor(value) ? value.trim().toUpperCase() : DEFAULT_MODULE_COLOR; }
export function moduleColorTextColor(value?: string) {
  const color = normalizeModuleColor(value);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return 0.299 * red + 0.587 * green + 0.114 * blue >= 150 ? '#242C2A' : '#FFFDF8';
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  return localDate(date) === value ? date : null;
}
export function remainingDays(expiry: string | undefined, now = new Date()) {
  const date = parseDate(expiry);
  if (!date) return null;
  // UTC day ordinals avoid daylight-saving offsets; components are local dates.
  return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000;
}
export function matchesFilter(item: Item, filter: Filter, now = new Date()) {
  if (filter === 'all') return true;
  if (item.quantity === 0) return false;
  const days = remainingDays(item.expiry, now);
  return days !== null && (filter === 'expired' ? days < 0 : days >= 0 && days <= (filter === 'week' ? 7 : 30));
}
export function statistics(items: Item[], now = new Date()): Record<Filter, number> {
  return { all: items.length, month: items.filter(i => matchesFilter(i, 'month', now)).length, week: items.filter(i => matchesFilter(i, 'week', now)).length, expired: items.filter(i => matchesFilter(i, 'expired', now)).length };
}
export function homeItems(items: Item[], rooms: Room[], homeId: string) {
  const ids = new Set(rooms.filter(r => r.homeId === homeId).map(r => r.id));
  return items.filter(i => ids.has(i.roomId));
}
export function directChildren(containers: Container[], roomId: string, containerId?: string) {
  return containers.filter(c => c.roomId === roomId && c.parentId === containerId);
}
export function directItems(items: Item[], roomId: string, containerId?: string) {
  return items.filter(i => i.roomId === roomId && i.containerId === containerId);
}
export function itemUsesGrid(item: Pick<Item, 'containerId'>, containers: Pick<Container, 'id' | 'level'>[]) {
  return item.containerId !== undefined && containers.some(container => container.id === item.containerId && container.level === 3);
}
export function containerDescendants(containers: Container[], containerId: string) {
  const ids = new Set<string>([containerId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const container of containers) {
      if (container.parentId && ids.has(container.parentId) && !ids.has(container.id)) {
        ids.add(container.id);
        changed = true;
      }
    }
  }
  return containers.filter(container => ids.has(container.id));
}
export function removeContainerContents(containers: Container[], items: Item[], containerId: string) {
  const ids = new Set(containerDescendants(containers, containerId).map(container => container.id));
  return {
    containers: containers.filter(container => !ids.has(container.id)),
    items: items.filter(item => !item.containerId || !ids.has(item.containerId)),
  };
}
export function matchesCategory(item: Pick<Item, 'categoryId'>, categoryId?: string) { return !categoryId || item.categoryId === categoryId; }
export function matchesSubcategory(item: Pick<Item, 'subcategoryId'>, subcategoryId?: string) { return !subcategoryId || item.subcategoryId === subcategoryId; }
export function filterItems<T extends Pick<Item, 'categoryId' | 'subcategoryId'> & { expiry?: string }>(items: T[], filter: Filter, categoryId?: string, now = new Date(), subcategoryId?: string) {
  return items.filter(item => matchesCategory(item, categoryId) && matchesSubcategory(item, subcategoryId) && matchesFilter(item as unknown as Item, filter, now));
}
export function removeSubcategoryAndMaybeCategory<T extends Pick<Item, 'categoryId' | 'subcategoryId'>>(categories: Category[], subcategories: Subcategory[], items: T[], subcategoryId: string) {
  const target = subcategories.find(subcategory => subcategory.id === subcategoryId);
  if (!target) return { categories, subcategories, items };
  const remainingSubcategories = subcategories.filter(subcategory => subcategory.id !== subcategoryId);
  const removeClothing = target.parentCategoryId === 'clothes' && !remainingSubcategories.some(subcategory => subcategory.parentCategoryId === 'clothes');
  const nextCategories = removeClothing ? categories.filter(category => category.id !== 'clothes') : categories;
  const nextItems = items.map(item => {
    const shouldClearCategory = removeClothing && item.categoryId === 'clothes';
    if (item.subcategoryId !== subcategoryId && !shouldClearCategory) return item;
    const { subcategoryId: _subcategoryId, ...withoutSubcategory } = item;
    return shouldClearCategory ? { ...withoutSubcategory, categoryId: 'uncategorized' } : withoutSubcategory;
  });
  return { categories: nextCategories, subcategories: removeClothing ? remainingSubcategories.filter(subcategory => subcategory.parentCategoryId !== 'clothes') : remainingSubcategories, items: nextItems };
}
export function removeHomeContents<T extends { id: string }, R extends { id: string; homeId: string }, C extends { id: string; roomId: string }, I extends { id: string; roomId: string }>(data: { homes: T[]; rooms: R[]; containers: C[]; items: I[] }, homeId: string, requireRemaining = false) {
  if (requireRemaining && data.homes.length <= 1) return { error: '至少保留一个家' } as const;
  const roomIds = new Set(data.rooms.filter(room => room.homeId === homeId).map(room => room.id));
  return { homes: data.homes.filter(home => home.id !== homeId), rooms: data.rooms.filter(room => room.homeId !== homeId), containers: data.containers.filter(container => !roomIds.has(container.roomId)), items: data.items.filter(item => !roomIds.has(item.roomId)) };
}
export function locationPath(roomId: string, containerId: string | undefined, homes: Home[], rooms: Room[], containers: Container[]) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return '';
  const names: string[] = [];
  const visited = new Set<string>();
  let current = containers.find(c => c.id === containerId && c.roomId === roomId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id); names.unshift(current.name);
    current = containers.find(c => c.id === current?.parentId && c.roomId === roomId);
  }
  return [homes.find(h => h.id === room.homeId)?.name, room.name, ...names].filter(Boolean).join(' → ');
}
export function validateName(name: string, scope: { id: string; name: string }[], editingId?: string) {
  if (!name.trim()) return '名称不能为空';
  if (name.trim().length > 40) return '名称最多 40 个字符';
  if (scope.some(x => x.id !== editingId && x.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) return '这个名称已经存在';
  return null;
}
export function createInitialData() {
  const expiry = new Date(); expiry.setDate(expiry.getDate() + 26);
  const homes: Home[] = [{ id: 'home', name: '我的家', greeting: DEFAULT_HOME_GREETING, note: DEFAULT_HOME_NOTE }];
  const rooms: Room[] = ['厨房', '卧室'].map((name, index) => ({ id: index === 0 ? 'kitchen' : 'bedroom', homeId: 'home', name, layout: { rows: 8, cols: 8 } }));
  const containers: Container[] = [
    { id: 'cabinet', name: '左侧橱柜', roomId: 'kitchen', level: 2, cells: [9, 10, 17, 18] },
    { id: 'drawer', name: '第二层抽屉', roomId: 'kitchen', parentId: 'cabinet', level: 3, cells: [0, 1, 8, 9] },
  ];
  const items: Item[] = [
    { id: 'tea', name: '乌龙茶', roomId: 'kitchen', containerId: 'drawer', quantity: 1, unit: '份', inventoryType: null, categoryId: 'drink', cell: 18, expiry: localDate(expiry), reminderDays: 7 },
    { id: 'bandage', name: '创可贴', roomId: 'bedroom', quantity: 1, unit: '份', inventoryType: null, categoryId: 'medicine', reminderDays: 7 },
  ];
  const categories: Category[] = [['food', '食物'], ['drink', '饮品'], ['medicine', '药品'], ['cleaning', '清洁用品'], ['clothes', '衣物'], ['tools', '工具'], ['documents', '文件'], ['other', '其他'], ['uncategorized', '未分类']].map(([id, name]) => ({ id, name, isSystem: id === 'uncategorized', allowSubcategories: id !== 'uncategorized' }));
  return { homes, rooms, containers, items, categories, subcategories: DEFAULT_SUBCATEGORIES.map(subcategory => ({ ...subcategory })) };
}
