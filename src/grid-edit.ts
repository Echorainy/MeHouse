import { itemUsesGrid, type Container, type Item, type RoomLayout } from './domain.ts';

export function cellAt(x: number, y: number, width: number, height = width, rows = 8, cols = 8): number | null {
  if (![x, y, width, height, rows, cols].every(Number.isFinite) || width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) return null;
  return Math.floor(y * rows / height) * cols + Math.floor(x * cols / width);
}

export function cellAtLocal(x: number, y: number, width: number, height = width, rows = 8, cols = 8): number | null {
  return cellAt(x, y, width, height, rows, cols);
}
export const cellFromGesture = cellAtLocal;

export function cellsOutsideLayout(cells: number[], from: RoomLayout, to: RoomLayout) {
  return cells.some(cell => {
    const row = Math.floor(cell / from.cols);
    const col = cell % from.cols;
    return row >= to.rows || col >= to.cols;
  });
}

export function paintCells(cells: number[], cell: number, adding: boolean, blocked: Set<number>) {
  if (blocked.has(cell)) return cells;
  return adding ? [...new Set([...cells, cell])] : cells.filter(c => c !== cell);
}

export function occupiedCells(roomId: string, parentId: string | undefined, containers: Container[], items: Item[], excludedContainerId?: string, excludedItemId?: string) {
  const occupied = new Set(containers
    .filter(c => c.id !== excludedContainerId && c.roomId === roomId && c.parentId === parentId)
    .flatMap(c => c.cells));
  items
    .filter(item => parentId !== undefined && itemUsesGrid(item, containers) && (excludedItemId === undefined || item.id !== excludedItemId) && item.roomId === roomId && item.containerId === parentId)
    .forEach(item => { if (item.cell !== undefined) occupied.add(item.cell); });
  return occupied;
}

export function occupiedCellsForContainer(id: string, containers: Container[], items: Item[]) {
  const target = containers.find(container => container.id === id);
  return target ? occupiedCells(target.roomId, target.parentId, containers, items, target.id) : new Set<number>();
}

export function validateCells(id: string, cells: number[], containers: Container[], items: Item[], layout: RoomLayout = { rows: 8, cols: 8 }): string | null {
  const target = containers.find(c => c.id === id);
  if (!target) return '模块不存在';
  if (!cells.length) return '请至少选择一个格子';
  if (cells.some(c => !Number.isInteger(c) || c < 0 || c >= layout.rows * layout.cols)) return '格子编号无效';
  const blocked = occupiedCellsForContainer(id, containers, items);
  return cells.some(c => blocked.has(c)) ? '格子已被其他模块或物品占用' : null;
}
