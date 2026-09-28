import test from 'node:test';
import assert from 'node:assert/strict';
import { cellAt, cellAtLocal, cellsOutsideLayout, occupiedCells, occupiedCellsForContainer, paintCells, validateCells } from '../src/grid-edit.ts';

test('grid coordinates reject overflow and map edge cells', () => {
  assert.deepEqual([[0,0], [319,319], [40,0], [0,40], [-1,0], [320,0], [0,320]].map(([x,y]) => cellAt(x,y,320)), [0,63,1,8,null,null,null]);
});
test('local coordinates map directly to the visible grid', () => {
  assert.equal(cellAtLocal(0, 0, 320), 0);
  assert.equal(cellAtLocal(100, 60, 320), 10);
  assert.equal(cellAtLocal(319.99, 319.99, 320), 63);
  assert.equal(cellAtLocal(-0.01, 100, 320), null);
  assert.equal(cellAtLocal(100, 320, 320), null);
});
test('cell mapping and validation use room dimensions', () => {
  assert.equal(cellAtLocal(99, 49, 120, 60, 6, 10), 48);
  const containers = [{ id: 'a', roomId: 'r', cells: [59] }];
  assert.equal(validateCells('a', [59], containers, [], { rows: 6, cols: 10 }), null);
  assert.equal(validateCells('a', [60], containers, [], { rows: 6, cols: 10 }), '格子编号无效');
});
test('resize checks preserve cell coordinates instead of remapping them', () => {
  assert.equal(cellsOutsideLayout([55], { rows: 8, cols: 8 }, { rows: 6, cols: 10 }), true);
  assert.equal(cellsOutsideLayout([45], { rows: 8, cols: 8 }, { rows: 6, cols: 10 }), false);
});
test('painting and erasing are idempotent and protect occupied cells', () => {
  const blocked = new Set([2]);
  assert.deepEqual(paintCells([1],1,true,blocked), [1]);
  assert.deepEqual(paintCells([1],2,true,blocked), [1]);
  assert.deepEqual(paintCells([1,3],1,false,blocked), [3]);
});
test('layout validation protects direct siblings but permits nested content', () => {
  const containers = [{id:'a',roomId:'r',cells:[0]}, {id:'b',roomId:'r',cells:[1]}, {id:'nested',roomId:'r',parentId:'a',cells:[3]}];
  const items = [{roomId:'r',cell:2}, {roomId:'r',containerId:'a',cell:4}];
  for (const cells of [[], [-1], [64], [1.5], [1]]) assert.ok(validateCells('a',cells,containers,items));
  assert.equal(validateCells('a',[2],containers,items), null);
  assert.ok(validateCells('missing',[0],containers,items));
  assert.equal(validateCells('a',[0,3,4],containers,items),null);
});
test('same-level occupancy excludes the edited module and unrelated descendants', () => {
  const containers = [
    {id:'a',roomId:'r',cells:[0,0,1]},
    {id:'b',roomId:'r',cells:[2]},
    {id:'nested',roomId:'r',parentId:'a',cells:[3]},
    {id:'other-room',roomId:'other',cells:[4]},
  ];
  const items = [
    {id:'root-item',roomId:'r',cell:5},
    {id:'nested-item',roomId:'r',containerId:'a',cell:6},
    {id:'other-item',roomId:'other',cell:7},
  ];
  assert.deepEqual([...occupiedCellsForContainer('a', containers, items)].sort((x, y) => x - y), [2]);
  assert.deepEqual([...occupiedCells('r', undefined, containers, items, undefined, 'root-item')].sort((x, y) => x - y), [0, 1, 2]);
  assert.equal(validateCells('a', [3], containers, items), null);
  assert.match(validateCells('a', [2], containers, items), /占用/);
});

test('directly placed items do not occupy room grid cells', () => {
  const containers = [{id:'module',roomId:'r',cells:[0]}];
  const items = [{id:'direct',roomId:'r',cell:5}];
  assert.deepEqual([...occupiedCells('r', undefined, containers, items)].sort((x, y) => x - y), [0]);
});

test('items directly in second-level modules do not occupy module grid cells', () => {
  const containers = [
    {id:'cabinet',roomId:'r',level:2,cells:[0]},
    {id:'drawer',roomId:'r',parentId:'cabinet',level:3,cells:[1]},
  ];
  const items = [
    {id:'cabinet-item',roomId:'r',containerId:'cabinet',cell:5},
    {id:'drawer-item',roomId:'r',containerId:'drawer',cell:6},
  ];
  assert.deepEqual([...occupiedCells('r', 'cabinet', containers, items)].sort((x, y) => x - y), [1]);
  assert.deepEqual([...occupiedCells('r', 'drawer', containers, items)].sort((x, y) => x - y), [6]);
});

test('a newly created empty module must choose cells before saving', () => {
  const containers = [{id:'new',roomId:'r',cells:[]}];
  assert.match(validateCells('new', [], containers, []), /至少选择/);
  assert.equal(validateCells('new', [10], containers, []), null);
});
