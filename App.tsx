import type { Snapshot } from './src/persistence';
import { completeMaintenance, consumeItem, restockItem, normalizeInventory, validateInventory } from './src/inventory';
import { InventoryActions, InventoryActionSheet, InventorySummary, InventoryReminders } from './src/InventoryUI';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, SafeAreaView, ScrollView, StatusBar, Switch, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Category, Container, Filter, Home, Item, Location, Room, Subcategory, DEFAULT_MODULE_COLOR, MODULE_COLORS, ROOM_SIZE_PRESETS, ROOM_DIMENSION_MIN, ROOM_DIMENSION_MAX, containerDescendants, createInitialData, directChildren, directItems, filterItems, filterLabels, homeItems, isValidHexColor, isValidRoomLayout, itemUsesGrid, locationPath, matchesFilter, moduleColorTextColor, normalizeModuleColor, removeContainerContents, removeHomeContents, removeSubcategoryAndMaybeCategory, validateName } from './src/domain';
import { cellsOutsideLayout, occupiedCells, validateCells } from './src/grid-edit';
import { Button, Chip, Empty, Field, FilterGroup, Icon, IconButton, IconName, Sheet, colors, s, useToday } from './src/ui';
import { HomePage, ItemRows, LayoutPage, RoomsPage } from './src/pages';
import { ItemForm } from './src/ItemForm';
import { ItemImage } from './src/ItemImage';
import { loadSnapshot, saveSnapshot } from './src/storage';
import { initializeNotifications, notificationsAvailable, requestNotificationPermission, rescheduleAllReminders } from './src/notifications';


type Tab = 'home' | 'rooms' | 'items' | 'settings';
type Editor = { kind: 'home' | 'room' | 'category' | 'subcategory' | 'container'; id?: string; roomId?: string; parentId?: string };
type Confirmation = { title: string; message: string; run: () => void };
let sequence = 0;
const newId = () => `local-${Date.now()}-${++sequence}`;

export default function App() {
  const [data, setSnapshot] = useState<Snapshot>(createInitialData);
  const dataRef = useRef(data);
  // Keep event handlers on the latest snapshot, including rapid repeated actions.
  const setData = useCallback((update: React.SetStateAction<Snapshot>) => {
    const next = typeof update === 'function' ? update(dataRef.current) : update;
    dataRef.current = next; setSnapshot(next);
  }, []);
  const [inventoryAction, setInventoryAction] = useState<{ id: string; kind: 'restock' | 'maintenance' }>();
  const [undoTokens, setUndoTokens] = useState<{ id: string; itemId: string; name: string; until: number }[]>([]);
  const undoRef = useRef(undoTokens);
  const [notificationError, setNotificationError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [notificationRevision, setNotificationRevision] = useState(0);
  const saveQueue = useRef(Promise.resolve());
  const { homes, rooms, containers, items, categories, subcategories } = data;
  const [activeHomeId, setActiveHomeId] = useState('home');
  const [tab, setTab] = useState<Tab>('home');
  const [location, setLocation] = useState<Location | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>();
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>();
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [homeMenu, setHomeMenu] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(DEFAULT_MODULE_COLOR);
  const [draftAllowSubcategories, setDraftAllowSubcategories] = useState(true);
  const [draftRows, setDraftRows] = useState('8');
  const [draftCols, setDraftCols] = useState('8');
  const [error, setError] = useState('');
  const [itemForm, setItemForm] = useState<{ initialLocation?: Location; item?: Item }>();
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [hydrated, setHydrated] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const now = useToday();
  const dayKey = now.toDateString();
  useEffect(() => {
    let active = true;
    loadSnapshot().then(snapshot => { if (active) { setData(snapshot); setHydrated(true); } }).catch(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveSnapshot(data)).then(() => setStorageError('')).catch(() => setStorageError('本地保存失败，请重试保存，避免关闭应用后丢失修改。'));
  }, [data, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    void rescheduleAllReminders(items).then(() => setNotificationError('')).catch(() => setNotificationError('系统提醒同步失败，应用内提醒仍可使用。'));
  }, [items, hydrated, notificationPermission, notificationRevision, dayKey]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') { setNotificationRevision(value => value + 1); void initializeNotifications().then(granted => setNotificationPermission(granted ? 'granted' : 'denied')).catch(() => undefined); } });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!undoTokens.length) return;
    const timer = setTimeout(() => { const next = undoRef.current.filter(token => token.until > Date.now()); undoRef.current = next; setUndoTokens(next); }, Math.max(1, Math.min(...undoTokens.map(token => token.until)) - Date.now()));
    return () => clearTimeout(timer);
  }, [undoTokens]);
  useEffect(() => { void initializeNotifications().then(granted => setNotificationPermission(granted ? 'granted' : 'denied')).catch(() => setNotificationPermission('denied')); }, []);
  const home = homes.find(h => h.id === activeHomeId)!;
  const currentRooms = rooms.filter(r => r.homeId === activeHomeId);
  const currentItems = homeItems(items, rooms, activeHomeId);
  const activeRoom = currentRooms.find(r => r.id === location?.roomId);
  const selectedItem = items.find(i => i.id === selectedItemId);
  const path = (item: Item | Location) => locationPath(item.roomId, item.containerId, homes, rooms, containers);
  const categoryName = (categoryId: string, subcategoryId?: string) => {
    const category = categories.find(c => c.id === categoryId)?.name ?? '未分类';
    const subcategory = subcategoryId ? subcategories.find(c => c.id === subcategoryId)?.name : undefined;
    return subcategory ? `${category} · ${subcategory}` : category;
  };
  const searchResults = items.filter(i => `${i.name} ${path(i)} ${categoryName(i.categoryId, i.subcategoryId)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const renderItems = (rows: Item[]) => <ItemRows items={rows} path={path} categoryName={categoryName} now={now} onItem={item => setSelectedItemId(item.id)} actions={inventoryCallbacks} />;

  const consume = (item: Item) => {
    const current = dataRef.current.items.find(record => record.id === item.id);
    if (!current || current.inventoryType !== 'consumable' || current.quantity <= 0) return;
    setData(d => ({ ...d, items: d.items.map(record => record.id === item.id ? consumeItem(record) : record) }));
    const tokens = [...undoRef.current.filter(token => token.until > Date.now()), { id: newId(), itemId: item.id, name: item.name, until: Date.now() + 5000 }];
    undoRef.current = tokens; setUndoTokens(tokens);
  };
  const undoConsumption = (id: string) => {
    const token = undoRef.current.find(entry => entry.id === id && entry.until > Date.now());
    if (!token) return;
    undoRef.current = undoRef.current.filter(entry => entry.id !== id); setUndoTokens(undoRef.current);
    setData(d => ({ ...d, items: d.items.map(item => item.id === token.itemId && item.inventoryType === 'consumable' && Number.isSafeInteger(item.quantity + 1) ? restockItem(item, 1) : item) }));
  };
  const inventoryCallbacks = {
    onConsume: consume,
    onRestock: (item: Item) => { setSelectedItemId(undefined); setInventoryAction({ id: item.id, kind: 'restock' }); },
    onMaintain: (item: Item) => { setSelectedItemId(undefined); setInventoryAction({ id: item.id, kind: 'maintenance' }); },
  };
  const actionItem = items.find(item => item.id === inventoryAction?.id);
  const saveInventoryAction = (value: number | string | undefined): string | null => {
    const current = dataRef.current.items.find(item => item.id === inventoryAction?.id);
    if (!current || !inventoryAction) return '物品已不存在';
    try {
      const next = inventoryAction.kind === 'restock' ? restockItem(current, Number(value)) : completeMaintenance(current, typeof value === 'string' ? value : undefined);
      setData(d => ({ ...d, items: d.items.map(item => item.id === current.id ? next : item) }));
      setInventoryAction(undefined); return null;
    } catch (error) { return error instanceof Error ? error.message : '保存失败'; }
  };
  const back = () => {
    if (!location) return;
    const module = containers.find(c => c.id === location.containerId);
    setLocation(module ? { roomId: location.roomId, containerId: module.parentId } : undefined);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'rooms' || !location || homeMenu || editor || itemForm || selectedItemId || confirmation || inventoryAction) return false;
      back(); return true;
    });
    return () => subscription.remove();
  }, [tab, location, containers, homeMenu, editor, itemForm, selectedItemId, confirmation, inventoryAction]);

  const switchHome = (id: string) => {
    setInventoryAction(undefined); undoRef.current = []; setUndoTokens([]);
    setActiveHomeId(id); setLocation(undefined); setFilter('all'); setCategoryFilter(undefined); setSubcategoryFilter(undefined); setQuery('');
    setHomeMenu(false); setItemForm(undefined); setSelectedItemId(undefined);
  };
  const openEditor = (kind: Editor['kind'], entity?: Home | Room | Category | Subcategory | Container, context?: { roomId?: string; parentId?: string }) => {
    const category = kind === 'category' ? entity as Category | undefined : undefined;
    const room = kind === 'room' ? entity as Room | undefined : undefined;
    setHomeMenu(false); setEditor({ kind, id: entity?.id, roomId: context?.roomId ?? (entity as Container | undefined)?.roomId, parentId: context?.parentId ?? (entity as Container | undefined)?.parentId ?? (entity as Subcategory | undefined)?.parentCategoryId }); setDraftName(entity?.name ?? ''); setDraftColor(kind === 'container' ? normalizeModuleColor((entity as Container | undefined)?.color) : DEFAULT_MODULE_COLOR); setDraftAllowSubcategories(category ? category.allowSubcategories : true); setDraftRows(String(room?.layout.rows ?? 8)); setDraftCols(String(room?.layout.cols ?? 8)); setError('');
  };
  const saveName = () => {
    if (!editor) return;
    const scope = editor.kind === 'home' ? homes : editor.kind === 'room' ? currentRooms : editor.kind === 'category' ? categories : editor.kind === 'subcategory' ? subcategories.filter(subcategory => subcategory.parentCategoryId === editor.parentId) : containers.filter(c => c.roomId === editor.roomId && c.parentId === editor.parentId);
    const message = validateName(draftName, scope, editor.id);
    if (message) return setError(message);
    if (editor.kind === 'category' && editor.id === 'uncategorized') return setError('未分类不能修改');
    if (editor.kind === 'category' && !draftAllowSubcategories && subcategories.some(subcategory => subcategory.parentCategoryId === editor.id)) { setDraftAllowSubcategories(true); return setError('请先删除全部二级分类'); }
    if (editor.kind === 'subcategory' && editor.parentId === 'uncategorized') return setError('未分类不能建立二级分类');
    if (editor.kind === 'container' && !isValidHexColor(draftColor)) return setError('请输入有效的 HEX 颜色，如 #C98F7A');
    const roomLayout = { rows: Number.parseInt(draftRows, 10), cols: Number.parseInt(draftCols, 10) };
    if (editor.kind === 'room' && (!/^\d+$/.test(draftRows.trim()) || !/^\d+$/.test(draftCols.trim()) || !isValidRoomLayout(roomLayout))) return setError(`行数和列数必须是 ${ROOM_DIMENSION_MIN}-${ROOM_DIMENSION_MAX} 的整数`);
    const name = draftName.trim(); const id = editor.id ?? newId();
    if (editor.kind === 'home') {
      setData(d => ({ ...d, homes: editor.id ? d.homes.map(h => h.id === id ? { ...h, name } : h) : [...d.homes, { id, name }] }));
      if (!editor.id) switchHome(id);
    } else if (editor.kind === 'room') {
      if (editor.id) {
        const existing = rooms.find(room => room.id === id);
        const hasOverflow = existing && (cellsOutsideLayout(containers.filter(container => container.roomId === id).flatMap(container => container.cells), existing.layout, roomLayout) || cellsOutsideLayout(items.filter(item => item.roomId === id && itemUsesGrid(item, containers) && item.cell !== undefined).map(item => item.cell!), existing.layout, roomLayout));
        if (hasOverflow) return setError('新尺寸会移除已有布局内容，请先调整模块或物品位置');
      }
      setData(d => ({ ...d, rooms: editor.id ? d.rooms.map(r => r.id === id ? { ...r, name, layout: roomLayout } : r) : [...d.rooms, { id, name, homeId: activeHomeId, layout: roomLayout }] }));
    } else if (editor.kind === 'category') {
      setData(d => ({ ...d, categories: editor.id ? d.categories.map(c => c.id === id ? { ...c, name, allowSubcategories: c.id === 'uncategorized' ? false : draftAllowSubcategories } : c) : [...d.categories, { id, name, isSystem: false, allowSubcategories: draftAllowSubcategories }] }));
    } else if (editor.kind === 'subcategory') {
      setData(d => ({ ...d, subcategories: editor.id ? d.subcategories.map(subcategory => subcategory.id === id ? { ...subcategory, name } : subcategory) : [...d.subcategories, { id, name, parentCategoryId: editor.parentId! }] }));
    } else {
      const level = editor.parentId ? 3 : 2;
      const color = normalizeModuleColor(draftColor);
      setData(d => ({ ...d, containers: editor.id ? d.containers.map(c => c.id === id ? { ...c, name, color } : c) : [...d.containers, { id, name, roomId: editor.roomId!, parentId: editor.parentId, level, cells: [], color }] }));
    }
    setEditor(undefined);
  };
  const beginItem = (initialLocation?: Location) => {
    if (!currentRooms.length) { setTab('rooms'); setLocation(undefined); openEditor('room'); return; }
    setItemForm({ initialLocation });
  };
  const saveItem = (draft: Omit<Item, 'id'>, editingId?: string) => {
    if (!currentRooms.some(r => r.id === draft.roomId)) return '请选择当前家的房间';
    if (draft.containerId && !containers.some(c => c.id === draft.containerId && c.roomId === draft.roomId)) return '请选择有效模块';
    const inventoryError = validateInventory(draft, !!editingId && !items.find(item => item.id === editingId)?.inventoryType && !draft.inventoryType);
    if (inventoryError) return inventoryError;
    const saved = { ...normalizeInventory(draft), id: editingId ?? newId() };
    if (!saved.subcategoryId || !subcategories.some(subcategory => subcategory.id === saved.subcategoryId && subcategory.parentCategoryId === saved.categoryId)) delete saved.subcategoryId;
    if (!itemUsesGrid(draft, containers)) delete saved.cell;
    else {
      const room = rooms.find(current => current.id === draft.roomId);
      const capacity = room ? room.layout.rows * room.layout.cols : 64;
      const occupied = occupiedCells(draft.roomId, draft.containerId, containers, items, undefined, editingId);
      saved.cell = draft.cell !== undefined && draft.cell < capacity && !occupied.has(draft.cell) ? draft.cell : Array.from({ length: capacity }, (_, i) => i).find(i => !occupied.has(i));
    }
    setData(d => ({ ...d, items: editingId ? d.items.map(i => i.id === editingId ? saved : i) : [...d.items, saved] }));

    setItemForm(undefined); return null;
  };
  const deleteContainer = (container: Container) => {
    const descendants = containerDescendants(containers, container.id);
    const itemCount = items.filter(i => i.containerId && descendants.some(c => c.id === i.containerId)).length;
    setConfirmation({ title: `删除模块“${container.name}”？`, message: `将删除 ${descendants.length} 个模块和 ${itemCount} 条物品记录，删除后无法恢复。`, run: () => {
      const result = removeContainerContents(containers, items, container.id);
      setData(d => ({ ...d, containers: result.containers, items: result.items }));
      setLocation(container.parentId ? { roomId: container.roomId, containerId: container.parentId } : { roomId: container.roomId });
    } });
  };
  const updateContainerCells = (id: string, cells: number[]) => { const target = containers.find(container => container.id === id); const room = target && rooms.find(current => current.id === target.roomId); const message = validateCells(id, cells, containers, items, room?.layout); if (message) return message; setData(d => ({ ...d, containers: d.containers.map(c => c.id === id ? { ...c, cells: [...new Set(cells)] } : c) })); return null; };
  const deleteRoom = (room: Room) => {
    const moduleCount = containers.filter(c => c.roomId === room.id).length;
    const itemCount = items.filter(i => i.roomId === room.id).length;
    setConfirmation({ title: `删除房间“${room.name}”？`, message: `将删除 ${moduleCount} 个模块和 ${itemCount} 条物品记录，删除后无法恢复。`, run: () => {
      setData(d => ({ ...d, rooms: d.rooms.filter(r => r.id !== room.id), containers: d.containers.filter(c => c.roomId !== room.id), items: d.items.filter(i => i.roomId !== room.id) }));
      setLocation(undefined); setSelectedItemId(undefined); setItemForm(undefined);
    } });
  };
  const deleteHome = (homeToDelete: Home) => {
    if (homes.length <= 1) return;
    const roomIds = new Set(rooms.filter(room => room.homeId === homeToDelete.id).map(room => room.id));
    const moduleCount = containers.filter(container => roomIds.has(container.roomId)).length;
    const itemCount = items.filter(item => roomIds.has(item.roomId)).length;
    setConfirmation({ title: `删除家“${homeToDelete.name}”？`, message: `将删除 ${roomIds.size} 个房间、${moduleCount} 个模块和 ${itemCount} 条物品记录，删除后无法恢复。`, run: () => {
      const result = removeHomeContents({ homes, rooms, containers, items }, homeToDelete.id, true);
      if ('error' in result) return;
      setData(data => ({ ...data, homes: result.homes, rooms: result.rooms, containers: result.containers, items: result.items }));
      setActiveHomeId(result.homes[0]?.id ?? ''); setLocation(undefined); setFilter('all'); setCategoryFilter(undefined); setQuery(''); setHomeMenu(false); setEditor(undefined); setItemForm(undefined); setSelectedItemId(undefined);
    } });
  };
  const deleteCategory = (category: Category) => {
    if (category.id === 'uncategorized') return;
    setConfirmation({ title: `删除分类“${category.name}”？`, message: '物品会保留，分类改为“未分类”。此修改适用于所有家。', run: () => {
      setData(d => ({ ...d, categories: d.categories.filter(c => c.id !== category.id), subcategories: d.subcategories.filter(subcategory => subcategory.parentCategoryId !== category.id), items: d.items.map(i => i.categoryId === category.id ? (() => { const { subcategoryId: _subcategoryId, ...item } = i; return { ...item, categoryId: 'uncategorized' }; })() : i) }));
      setCategoryFilter(current => current === category.id ? undefined : current);
      setSubcategoryFilter(current => current && (categoryFilter === category.id || subcategories.some(subcategory => subcategory.id === current && subcategory.parentCategoryId === category.id)) ? undefined : current);
    } });
  };
  const deleteSubcategory = (subcategory: Subcategory) => {
    const removesClothing = subcategory.parentCategoryId === 'clothes' && subcategories.filter(current => current.parentCategoryId === 'clothes').length === 1;
    setConfirmation({ title: `删除二级分类“${subcategory.name}”？`, message: removesClothing ? '这会同时删除“衣物”一级分类，相关物品会转为“未分类”。' : '相关物品会保留一级分类，只清空二级分类。', run: () => {
      setData(d => { const result = removeSubcategoryAndMaybeCategory(d.categories, d.subcategories, d.items, subcategory.id); return { ...d, ...result }; });
      setSubcategoryFilter(current => current === subcategory.id ? undefined : current);
      if (removesClothing) setCategoryFilter(current => current === 'clothes' ? undefined : current);
    } });
  };
  const deleteItem = (item: Item) => {
    setConfirmation({ title: `删除物品“${item.name}”？`, message: '删除后无法恢复，同时会取消它的所有提醒。', run: () => {
      setData(d => ({ ...d, items: d.items.filter(i => i.id !== item.id) }));
      setSelectedItemId(undefined);
    } });
  };
  const chooseTab = (next: Tab) => { setTab(next); if (next === 'rooms') setLocation(undefined); if (next === 'items') { setFilter('all'); setCategoryFilter(undefined); setSubcategoryFilter(undefined); } };
  const nav: [Tab, IconName, string][] = [['home', 'home', '首页'], ['rooms', 'grid', '房间'], ['items', 'package', '物品'], ['settings', 'settings', '设置']];
  const renderCategoryToggle = (category: Category, children: Subcategory[], expanded: boolean) => category.allowSubcategories
    ? <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? '收起' : '展开'}二级分类 ${category.name}`} onPress={() => setExpandedCategoryIds(current => ({ ...current, [category.id]: !current[category.id] }))} style={s.categoryToggle}><View style={[s.categoryTag, s.categoryTagPrimary]}><Text style={s.label}>{category.name}</Text></View><View testID={`category-toggle-arrow-${category.id}`}><Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.accent} /></View></Pressable>
    : <View style={[s.categoryTag, s.categoryTagPrimary, { opacity: .8 }]}><Text style={s.label}>{category.name}</Text></View>;

  if (!hydrated) return <SafeAreaView style={s.screen}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}><ActivityIndicator color={colors.accent} /><Text style={s.muted}>正在读取本地数据…</Text></View></SafeAreaView>;
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaView style={s.screen}><StatusBar barStyle="dark-content" />{!!storageError && <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{storageError}</Text><Button title="重试保存" secondary onPress={() => setData(d => ({ ...d }))} /></View>}<View style={s.content}>
    {tab === 'home' && <HomePage home={home} items={currentItems} query={query} setQuery={setQuery} searchResults={searchResults} onHomes={() => setHomeMenu(true)} onOpenAllItems={() => { setFilter('all'); setCategoryFilter(undefined); setSubcategoryFilter(undefined); setTab('items'); }} onAdd={() => beginItem()} onSaveCopy={(greeting, note) => setData(d => ({ ...d, homes: d.homes.map(h => h.id === activeHomeId ? { ...h, greeting, note } : h) }))} renderItems={renderItems} now={now} inventoryReminders={<InventoryReminders items={currentItems} now={now} path={path} onItem={item => setSelectedItemId(item.id)} {...inventoryCallbacks} />} />}
    {tab === 'rooms' && (activeRoom && location
      ? <LayoutPage room={activeRoom} location={location} containers={containers} items={items} path={path(location)} onBack={back} onEnter={id => setLocation({ roomId: activeRoom.id, containerId: id })} onItem={i => setSelectedItemId(i.id)} onAdd={() => beginItem(location)} onCreateContainer={() => openEditor('container', undefined, { roomId: activeRoom.id, parentId: location.containerId })} onRenameContainer={c => openEditor('container', c)} onDeleteContainer={deleteContainer} onUpdateContainerCells={updateContainerCells} onDelete={() => deleteRoom(activeRoom)} renderItems={renderItems} />
      : <RoomsPage home={home} rooms={currentRooms} containers={containers} items={currentItems} onOpen={id => setLocation({ roomId: id })} onCreate={() => openEditor('room')} onRename={room => openEditor('room', room)} onDelete={deleteRoom} />)}
    {tab === 'items' && <ScrollView contentContainerStyle={s.page}>
      <View style={s.pageIntro}><Text style={s.title}>物品</Text><View style={s.sectionHeader}><Text style={[s.muted, { flex: 1 }]}>{home.name}</Text><Text style={s.muted}>{currentItems.length} 条记录</Text></View></View>
      <View style={{ gap: 12 }}>
        <FilterGroup title="过期时间" summary="全部分类" defaultExpanded>
          <View style={s.wrap}>{(Object.keys(filterLabels) as Filter[]).map(key => <Chip key={key} label={filterLabels[key]} selected={filter === key} onPress={() => setFilter(key)} />)}</View>
        </FilterGroup>
        <FilterGroup title="物品分类" summary="全部分类">
          <View style={s.wrap}><Chip label="全部分类" selected={!categoryFilter} onPress={() => { setCategoryFilter(undefined); setSubcategoryFilter(undefined); }} />{categories.map(category => <Chip key={category.id} label={category.name} variant="primaryCategory" selected={categoryFilter === category.id} onPress={() => { setCategoryFilter(category.id); setSubcategoryFilter(undefined); }} />)}</View>
          {!!categoryFilter && subcategories.some(subcategory => subcategory.parentCategoryId === categoryFilter) && <>
            <Text style={s.label}>二级分类</Text>
            <View style={s.wrap}><Chip label="全部二级分类" variant="secondaryCategory" selected={!subcategoryFilter} onPress={() => setSubcategoryFilter(undefined)} />{subcategories.filter(subcategory => subcategory.parentCategoryId === categoryFilter).map(subcategory => <Chip key={subcategory.id} label={subcategory.name} variant="secondaryCategory" selected={subcategoryFilter === subcategory.id} onPress={() => setSubcategoryFilter(subcategory.id)} />)}</View>
          </>}
        </FilterGroup>
      </View>
      <View style={s.itemListCard}>{renderItems(filterItems(currentItems, filter, categoryFilter, now, subcategoryFilter))}</View>
      <Button title="记录物品" icon="plus" onPress={() => beginItem()} />
    </ScrollView>}
    {tab === 'settings' && <ScrollView contentContainerStyle={s.page}><View style={s.pageIntro}><Text style={s.title}>设置</Text><Text style={s.muted}>把家庭、分类和提醒整理成适合你的样子。</Text></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>家庭管理</Text><Text style={s.statusBadge}>{homes.length} 个家</Text></View>{homes.map((h, index) => <View key={h.id} style={[s.settingsRow, index === homes.length - 1 && s.settingsRowLast]}><Pressable accessibilityRole="button" accessibilityLabel={`切换到 ${h.name}`} onPress={() => switchHome(h.id)} style={[s.row, s.settingsCopy]}><Icon name={activeHomeId === h.id ? 'check-circle' : 'home'} color={activeHomeId === h.id ? colors.accent : colors.muted} /><Text style={[s.label, { flexShrink: 1 }]}>{h.name}</Text></Pressable><View style={s.settingsActions}><IconButton name="edit-2" label={`重命名家庭 ${h.name}`} onPress={() => openEditor('home', h)} />{homes.length > 1 && <IconButton name="trash-2" label={`删除家庭 ${h.name}`} onPress={() => deleteHome(h)} />}</View></View>)}<Button title="新建家" icon="plus" secondary onPress={() => openEditor('home')} /></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>分类标签</Text><Text style={s.statusBadge}>{categories.length} 个一级分类</Text></View>{categories.map((c, index) => { const children = subcategories.filter(subcategory => subcategory.parentCategoryId === c.id); const expanded = !!expandedCategoryIds[c.id]; return <View key={c.id} style={[s.settingsRow, index === categories.length - 1 && s.settingsRowLast]}><View style={s.settingsCopy}><View style={s.row}>{renderCategoryToggle(c, children, expanded)}</View><Text style={s.sectionCaption}>{c.isSystem ? '系统分类' : '可编辑分类'}</Text>{expanded && <View style={s.subcategoryManageList}>{children.map(subcategory => <View key={subcategory.id} style={s.subcategoryManageRow}><Chip label={subcategory.name} variant="secondaryCategory" selected={false} interactive={false} onPress={() => undefined} /><View style={s.settingsActions}><IconButton name="edit-2" label={`修改二级分类 ${subcategory.name}`} onPress={() => openEditor('subcategory', subcategory)} /><IconButton name="trash-2" label={`删除二级分类 ${subcategory.name}`} onPress={() => deleteSubcategory(subcategory)} /></View></View>)}</View>}{expanded && c.allowSubcategories && <Button title={`新增${c.name}二级分类`} icon="plus" secondary onPress={() => openEditor('subcategory', undefined, { parentId: c.id })} />}</View>{!c.isSystem && <View style={s.settingsActions}><IconButton name="edit-2" label={`修改分类 ${c.name}`} onPress={() => openEditor('category', c)} /><IconButton name="trash-2" label={`删除分类 ${c.name}`} onPress={() => deleteCategory(c)} /></View>}</View>; })}<Button title="新增分类" icon="plus" secondary onPress={() => openEditor('category')} /></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>提醒通知</Text><Icon name="bell" color={colors.accent} /></View><Text style={s.sectionCaption}>{!notificationsAvailable ? '当前预览环境不启用系统通知，到期、补货和检修提醒仍会在应用内显示。' : notificationPermission === 'granted' ? '已允许到期、补货和检修通知' : '尚未允许发送本地通知'}</Text><Button title="启用提醒通知" icon="bell" secondary disabled={!notificationsAvailable || notificationPermission === 'granted'} onPress={() => { void requestNotificationPermission().then(granted => { setNotificationPermission(granted ? 'granted' : 'denied'); setNotificationRevision(value => value + 1); }).catch(() => setNotificationError('无法请求通知权限，请在系统设置中检查。')); }} />{!!notificationError && <><Text accessibilityRole="alert" style={s.error}>{notificationError}</Text><Button title="重试提醒同步" secondary onPress={() => setNotificationRevision(value => value + 1)} /></>}</View></ScrollView>}
  </View>{undoTokens.length > 0 && !selectedItemId && <ScrollView style={{ maxHeight: 120, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16 }}>{undoTokens.map(token => <View key={token.id} style={s.headingRow}><Text style={[s.muted, { flex: 1 }]}>{token.name} 已消耗一份</Text><Button title="撤销" label={`撤销消耗 ${token.name}`} secondary onPress={() => undoConsumption(token.id)} /></View>)}</ScrollView>}<View style={s.nav}>{nav.map(([key, icon, label]) => <Pressable {...({ 'aria-selected': tab === key } as any)} key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === key }} style={s.navItem} onPress={() => chooseTab(key)}><Icon name={icon} color={tab === key ? colors.accent : colors.muted} /><Text style={[s.navLabel, tab === key && { color: colors.accent }]}>{label}</Text></Pressable>)}</View>
    {homeMenu && <Sheet title="选择家庭" onClose={() => setHomeMenu(false)}>{homes.map(h => <View key={h.id} style={s.headingRow}><Pressable accessibilityRole="button" accessibilityLabel={`切换到 ${h.name}`} onPress={() => switchHome(h.id)} style={[s.row, { flex: 1, minHeight: 48 }]}><Icon name={h.id === activeHomeId ? 'check-circle' : 'home'} /><Text style={[s.label, { flexShrink: 1 }]}>{h.name}</Text></Pressable><IconButton name="edit-2" label={`重命名家庭 ${h.name}`} onPress={() => openEditor('home', h)} />{homes.length > 1 && <IconButton name="trash-2" label={`删除家庭 ${h.name}`} onPress={() => deleteHome(h)} />}</View>)}<Button title="新建家" icon="plus" onPress={() => openEditor('home')} /></Sheet>}
    {editor && <Sheet title={`${editor.id ? '编辑' : '新增'}${editor.kind === 'home' ? '家庭' : editor.kind === 'room' ? '房间' : editor.kind === 'category' ? '分类' : editor.kind === 'subcategory' ? '二级分类' : '模块'}`} onClose={() => setEditor(undefined)}><Field label="名称" value={draftName} onChangeText={setDraftName} />{editor.kind === 'room' && <View style={{ gap: 10, marginVertical: 10 }}><Text style={s.label}>房间格子</Text><View style={s.wrap}>{ROOM_SIZE_PRESETS.map(size => { const selected = draftRows === String(size) && draftCols === String(size); return <Chip key={size} label={`${size}×${size}`} selected={selected} onPress={() => { setDraftRows(String(size)); setDraftCols(String(size)); }} />; })}</View><View style={s.row}><Field label="行数" value={draftRows} onChangeText={setDraftRows} numeric containerStyle={{ flex: 1 }} /><Field label="列数" value={draftCols} onChangeText={setDraftCols} numeric containerStyle={{ flex: 1 }} /></View><Text style={s.muted}>可输入 {ROOM_DIMENSION_MIN}-{ROOM_DIMENSION_MAX} 的整数</Text></View>}{editor.kind === 'category' && <View style={s.categoryCapabilityRow}><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>允许添加二级分类</Text><Text style={s.muted}>{editor.id === 'uncategorized' ? '未分类不能建立二级分类' : '开启后可在设置中新增二级分类'}</Text></View><Switch accessibilityRole="switch" accessibilityLabel="允许添加二级分类" accessibilityState={{ checked: editor.id === 'uncategorized' ? false : draftAllowSubcategories, disabled: editor.id === 'uncategorized' }} disabled={editor.id === 'uncategorized'} value={editor.id === 'uncategorized' ? false : draftAllowSubcategories} onValueChange={setDraftAllowSubcategories} trackColor={{ false: colors.line, true: colors.accent }} thumbColor={colors.surface} /></View>}{editor.kind === 'subcategory' && <Text style={s.muted}>所属一级分类：{categories.find(category => category.id === editor.parentId)?.name ?? '未分类'}</Text>}{editor.kind === 'container' && <View style={{ gap: 8, marginVertical: 10 }}><Text style={s.label}>模块颜色</Text><View style={s.wrap}>{MODULE_COLORS.map((color, index) => { const selected = draftColor.trim().toUpperCase() === color; return <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`选择模块颜色 ${index + 1}`} accessibilityState={{ selected }} onPress={() => setDraftColor(color)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color, borderWidth: selected ? 3 : 1, borderColor: selected ? colors.ink : colors.line, alignItems: 'center', justifyContent: 'center' }}>{selected && <Text style={{ color: moduleColorTextColor(color), fontWeight: '700' }}>✓</Text>}</Pressable>; })}</View><Field label="HEX 色值" value={draftColor} onChangeText={setDraftColor} placeholder="#C98F7A" /></View>}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={editor.kind === 'container' ? '保存模块' : editor.kind === 'subcategory' ? '保存二级分类' : '保存名称'} onPress={saveName} /></Sheet>}
    {itemForm && <ItemForm rooms={currentRooms} containers={containers} categories={categories} subcategories={subcategories} initialLocation={itemForm.initialLocation} item={itemForm.item} onClose={() => setItemForm(undefined)} onSave={saveItem} />}
    {selectedItem && <Sheet title={selectedItem.name} onClose={() => setSelectedItemId(undefined)}><View style={{ gap: 12 }}><View style={{ alignItems: 'center' }}><ItemImage uri={selectedItem.imageUri} size={96} /></View><Text style={s.muted}>{path(selectedItem)}</Text><Text style={s.label}>分类：{categoryName(selectedItem.categoryId, selectedItem.subcategoryId)}</Text><Text style={s.muted}>{selectedItem.expiry ? `过期日期：${selectedItem.expiry}` : '未设置保质期'}</Text><InventorySummary item={selectedItem} />{selectedItem.inventoryType === 'consumable' && <Text style={s.muted}>库存线：{selectedItem.restockThreshold} {selectedItem.unit}</Text>}{selectedItem.inventoryType === 'durable' && <><Text style={s.muted}>{selectedItem.maintenanceDate ? `检修日期：${selectedItem.maintenanceDate} · 提前 ${selectedItem.maintenanceLeadDays} 天提醒` : '未设置检修'}</Text>{!!selectedItem.lastMaintenanceDate && <Text style={s.muted}>上次检修：{selectedItem.lastMaintenanceDate}</Text>}</>}<InventoryActions item={selectedItem} {...inventoryCallbacks} />{undoTokens.filter(token => token.itemId === selectedItem.id).map(token => <Button key={token.id} title="撤销消耗" label={`撤销消耗 ${selectedItem.name}`} secondary onPress={() => undoConsumption(token.id)} />)}<Button title={selectedItem.inventoryType ? '编辑物品' : '设置库存类型'} icon="edit-2" onPress={() => { setItemForm({ item: selectedItem }); setSelectedItemId(undefined); }} /><Button title="删除物品" icon="trash-2" secondary onPress={() => deleteItem(selectedItem)} /></View></Sheet>}
    {inventoryAction && actionItem && <InventoryActionSheet key={`${inventoryAction.kind}:${actionItem.id}`} item={actionItem} kind={inventoryAction.kind} onClose={() => setInventoryAction(undefined)} onSave={saveInventoryAction} />}
    {confirmation && <Sheet title={confirmation.title} onClose={() => setConfirmation(undefined)}><Text style={s.muted}>{confirmation.message}</Text><Button title="确认删除" onPress={() => { confirmation.run(); setConfirmation(undefined); }} /><Button title="取消" secondary onPress={() => setConfirmation(undefined)} /></Sheet>}
  </SafeAreaView></GestureHandlerRootView>;
}
