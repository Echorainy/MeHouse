import { localDate, parseDate, remainingDays, type Item } from './domain.ts';

export type InventoryType = 'consumable' | 'durable' | null;
export type InventoryFields = {
  quantity: number; unit: string; inventoryType: InventoryType;
  restockThreshold?: number; maintenanceDate?: string; maintenanceLeadDays?: number; lastMaintenanceDate?: string;
};
export const inventoryLabels = { consumable: '消耗品', durable: '耐用品', unset: '待设置' };
export const inventoryLabel = (item: Pick<Item, 'inventoryType'>) => inventoryLabels[item.inventoryType ?? 'unset'];
export function parseCount(value: string): number | null {
  return /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
const validCount = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
export function normalizeInventory<T extends Partial<InventoryFields>>(item: T): T & InventoryFields {
  const normalized = { ...item, quantity: validCount(item.quantity) ? item.quantity : 1, unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim().slice(0, 12) : '份', inventoryType: item.inventoryType === 'consumable' || item.inventoryType === 'durable' ? item.inventoryType : null } as T & InventoryFields;
  if (normalized.inventoryType === 'consumable') normalized.restockThreshold = validCount(item.restockThreshold, 1) ? item.restockThreshold : 1;
  else delete normalized.restockThreshold;
  if (normalized.inventoryType === 'durable') {
    if (!parseDate(item.maintenanceDate)) delete normalized.maintenanceDate;
    normalized.maintenanceLeadDays = validCount(item.maintenanceLeadDays) && item.maintenanceLeadDays <= 36500 ? item.maintenanceLeadDays : 7;
    if (!parseDate(item.lastMaintenanceDate)) delete normalized.lastMaintenanceDate;
  } else {
    delete normalized.maintenanceDate; delete normalized.maintenanceLeadDays; delete normalized.lastMaintenanceDate;
  }
  return normalized;
}
export function validateInventory(item: Partial<InventoryFields>, allowUnset = false): string | null {
  if (!validCount(item.quantity)) return '数量必须是非负整数';
  if (!item.unit?.trim() || item.unit.trim().length > 12) return '请填写 1–12 个字符的单位';
  if (!item.inventoryType && !allowUnset) return '请选择消耗品或耐用品';
  if (item.inventoryType === 'consumable' && !validCount(item.restockThreshold, 1)) return '库存线必须是正整数';
  if (item.inventoryType === 'durable' && item.maintenanceDate) {
    if (!parseDate(item.maintenanceDate)) return '请输入有效的检修日期';
    if (!validCount(item.maintenanceLeadDays) || item.maintenanceLeadDays > 36500) return '提前提醒天数必须是 0–36500 的整数';
  }
  return null;
}
export const needsRestock = (item: Item) => item.inventoryType === 'consumable' && item.quantity < (item.restockThreshold ?? 1);
export function needsMaintenance(item: Item, now = new Date()) {
  const days = remainingDays(item.maintenanceDate, now);
  return item.inventoryType === 'durable' && item.quantity > 0 && days !== null && days <= (item.maintenanceLeadDays ?? 7);
}
export function consumeItem(item: Item): Item {
  return item.inventoryType === 'consumable' && item.quantity > 0 ? { ...item, quantity: item.quantity - 1 } : item;
}
export function restockItem(item: Item, amount: number): Item {
  if (!validCount(amount, 1) || !Number.isSafeInteger(item.quantity + amount)) throw new Error('补货数量必须是有效正整数');
  return item.inventoryType === 'consumable' ? { ...item, quantity: item.quantity + amount } : item;
}
export function completeMaintenance(item: Item, nextDate?: string, now = new Date()): Item {
  if (nextDate && !parseDate(nextDate)) throw new Error('请输入有效的下一次检修日期');
  return item.inventoryType === 'durable' ? { ...item, lastMaintenanceDate: localDate(now), maintenanceDate: nextDate || undefined } : item;
}
