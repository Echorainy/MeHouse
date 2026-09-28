import { createInitialData } from './domain.ts';
import { DEFAULT_HOME_GREETING, DEFAULT_HOME_NOTE, DEFAULT_SUBCATEGORIES, isValidRoomLayout, itemUsesGrid } from './domain.ts';
import type { Category, Container, Home, Item, Room, Subcategory } from './domain.ts';

export type Snapshot = { homes: Home[]; rooms: Room[]; containers: Container[]; items: Item[]; categories: Category[]; subcategories: Subcategory[] };
export const emptySnapshot = (): Snapshot => createInitialData();

export function encodeSnapshot(snapshot: Snapshot) { return JSON.stringify(snapshot); }
export function decodeSnapshot(value: string): Snapshot {
  const parsed = JSON.parse(value);
  if (!isSnapshot(parsed)) throw new Error('Invalid snapshot');
  const candidate = parsed as Snapshot & { subcategories?: Subcategory[] };
  const isLegacy = !Array.isArray(candidate.subcategories);
  const categories = candidate.categories.map(category => ({ ...category, name: isLegacy && category.id === 'food' ? '食物' : category.name, allowSubcategories: category.id !== 'uncategorized' && category.allowSubcategories !== false }));
  if (isLegacy && !categories.some(category => category.id === 'food')) categories.unshift({ id: 'food', name: '食物', isSystem: false, allowSubcategories: true });
  if (isLegacy && !categories.some(category => category.id === 'clothes')) categories.splice(Math.max(0, categories.findIndex(category => category.id === 'tools')), 0, { id: 'clothes', name: '衣物', isSystem: false, allowSubcategories: true });
  const subcategories = isLegacy
    ? [...(candidate.subcategories ?? []), ...DEFAULT_SUBCATEGORIES.filter(defaultSubcategory => !(candidate.subcategories ?? []).some(subcategory => subcategory.id === defaultSubcategory.id)).map(subcategory => ({ ...subcategory }))]
    : candidate.subcategories ?? [];
  const categoryIds = new Set(categories.map(category => category.id));
  const childParents = new Set(subcategories.filter(subcategory => categoryIds.has(subcategory.parentCategoryId) && subcategory.parentCategoryId !== 'uncategorized').map(subcategory => subcategory.parentCategoryId));
  const capableCategories = categories.map(category => category.id === 'uncategorized' ? { ...category, allowSubcategories: false } : childParents.has(category.id) ? { ...category, allowSubcategories: true } : category);
  const validSubcategories = subcategories.filter(subcategory => capableCategories.some(category => category.id === subcategory.parentCategoryId && category.allowSubcategories));
  const hasClothingSubcategories = validSubcategories.some(subcategory => subcategory.parentCategoryId === 'clothes');
  const normalizedCategories = hasClothingSubcategories ? capableCategories : capableCategories.filter(category => category.id !== 'clothes');
  const normalizedSubcategories = hasClothingSubcategories ? validSubcategories : validSubcategories.filter(subcategory => subcategory.parentCategoryId !== 'clothes');
  const normalizedCategoryIds = new Set(normalizedCategories.map(category => category.id));
  const subcategoryParents = new Map(normalizedSubcategories.map(subcategory => [subcategory.id, subcategory.parentCategoryId]));
  return {
    ...parsed,
    categories: normalizedCategories,
    subcategories: normalizedSubcategories,
    homes: parsed.homes.map(home => ({ ...home, greeting: home.greeting ?? DEFAULT_HOME_GREETING, note: home.note ?? DEFAULT_HOME_NOTE })),
    containers: parsed.containers.map(container => ({ ...container, cells: [...new Set(container.cells)] })),
    items: parsed.items.map(item => {
      const clothingWasRemoved = item.categoryId === 'clothes' && !normalizedCategoryIds.has('clothes');
      const normalized = clothingWasRemoved
        ? (() => { const { subcategoryId: _subcategoryId, ...withoutSubcategory } = item; return { ...withoutSubcategory, categoryId: 'uncategorized' }; })()
        : item.subcategoryId && subcategoryParents.get(item.subcategoryId) === item.categoryId
          ? item
          : (() => { const { subcategoryId: _subcategoryId, ...withoutSubcategory } = item; return withoutSubcategory; })();
      if (itemUsesGrid(normalized, parsed.containers)) return normalized;
      const { cell: _cell, ...directItem } = normalized;
      return directItem;
    }),
  };
}
function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Snapshot>;
  return Array.isArray(candidate.homes) && Array.isArray(candidate.rooms) && Array.isArray(candidate.containers) && Array.isArray(candidate.items) && Array.isArray(candidate.categories) && candidate.rooms.every(room => room && typeof room.id === 'string' && typeof room.homeId === 'string' && isValidRoomLayout(room.layout));
}
export function migrateSnapshot(value: string | null | undefined): Snapshot {
  if (!value) return emptySnapshot();
  try { return decodeSnapshot(value); } catch { return emptySnapshot(); }
}
