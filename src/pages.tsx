import { InventoryActions, InventorySummary, type InventoryCallbacks } from './InventoryUI';
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Container, Filter, Home, Item, Location, Room, DEFAULT_HOME_GREETING, DEFAULT_HOME_NOTE, directChildren, directItems, filterItems, filterLabels, moduleColorTextColor, normalizeModuleColor, remainingDays, statistics } from './domain';
import { Button, Empty, Field, Icon, IconButton, Mascot, Sheet, colors, s } from './ui';
import { cellAt, cellFromGesture, occupiedCellsForContainer } from './grid-edit';

export function GridEditor({ initialCells, blockedCells, color, layout, onCancel, onSave }: { initialCells: number[]; blockedCells: number[]; color?: string; layout: Room['layout']; onCancel: () => void; onSave: (cells: number[]) => string | null }) {
  const [width, setWidth] = useState(0);
  const [cells, setCells] = useState(() => [...new Set(initialCells)]);
  const [error, setError] = useState('');
  const cellsRef = useRef(cells);
  const touched = useRef(new Set<number>());
  const mode = useRef<'add' | 'remove'>('add');
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const blocked = new Set(blockedCells);
  const toggleCell = (cell: number) => {
    if (dragging.current || blocked.has(cell)) return;
    const next = cellsRef.current.includes(cell) ? cellsRef.current.filter(value => value !== cell) : [...cellsRef.current, cell];
    cellsRef.current = next;
    setCells(next);
  };
  const paint = (x: number, y: number) => {
    const cell = cellFromGesture(x, y, width, width, layout.rows, layout.cols);
    if (cell === null || blocked.has(cell) || touched.current.has(cell)) return;
    touched.current.add(cell);
    const next = mode.current === 'add' ? [...new Set([...cellsRef.current, cell])] : cellsRef.current.filter(value => value !== cell);
    cellsRef.current = next;
    setCells(next);
  };
  const handleGestureEvent = (event: any) => paint(event.nativeEvent.x, event.nativeEvent.y);
  const handleStateChange = (event: any) => {
    const { state, x, y } = event.nativeEvent;
    if (state === State.BEGAN) {
      touched.current.clear();
      const start = cellFromGesture(x, y, width, width, layout.rows, layout.cols);
      mode.current = start !== null && !cellsRef.current.includes(start) ? 'add' : 'remove';
      startPoint.current = { x, y };
      dragging.current = false;
    } else if (state === State.ACTIVE) {
      dragging.current = true;
      if (startPoint.current) paint(startPoint.current.x, startPoint.current.y);
      paint(x, y);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      touched.current.clear();
      startPoint.current = null;
      if (state === State.FAILED) dragging.current = false;
    }
  };
  return <View style={{ gap: 12 }}><PanGestureHandler minDist={4} onGestureEvent={handleGestureEvent} onHandlerStateChange={handleStateChange}><View testID="grid-editor" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: layout.cols / layout.rows, backgroundColor: colors.gridEmpty, overflow: 'hidden' }}>
    {width > 0 && Array.from({ length: layout.rows * layout.cols }, (_, cell) => { const selected = cells.includes(cell); const unavailable = blocked.has(cell); const selectedColor = normalizeModuleColor(color); const size = width / layout.cols; return <Pressable key={cell} accessibilityRole="button" accessibilityLabel={`编辑第 ${cell + 1} 格`} disabled={unavailable} onPress={() => toggleCell(cell)} style={{ position: 'absolute', left: (cell % layout.cols) * size, top: Math.floor(cell / layout.cols) * size, width: size, height: size, borderWidth: selected ? 1.5 : .5, borderColor: selected ? colors.ink : colors.line, backgroundColor: unavailable ? colors.gridBlocked : selected ? selectedColor : colors.gridEmpty, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 9, color: unavailable ? colors.muted : selected ? moduleColorTextColor(selectedColor) : colors.muted }}>{selected ? '✓' : ''}</Text></Pressable>; })}
  </View></PanGestureHandler><Text style={s.muted}>已选择 {cells.length} 格，可点击或拖动选择</Text>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<View style={s.row}><Button title="保存布局" onPress={() => { const message = onSave(cells); if (message) setError(message); }} /><Button title="取消" secondary onPress={onCancel} /></View></View>;
}

export function ItemRows({ items, path, categoryName, now, onItem, actions }: { items: Item[]; path: (item: Item) => string; categoryName: (categoryId: string, subcategoryId?: string) => string; now: Date; onItem: (item: Item) => void; actions?: InventoryCallbacks }) {
  if (!items.length) return <Empty text="暂无物品" />;
  return <View>{items.map(item => {
    const days = remainingDays(item.expiry, now);
    const status = item.quantity === 0 ? '已用完' : days === null ? '无保质期' : days < 0 ? `已过期 ${-days} 天` : days === 0 ? '今天到期' : `${days} 天后到期`;
    const statusStyle = days !== null && days < 0 ? s.statusExpired : days !== null && days <= 7 ? s.statusSoon : s.statusNormal;
    return <View key={item.id} style={[s.card, { marginBottom: 10 }]}><Pressable accessibilityRole="button" accessibilityLabel={`查看物品 ${item.name}`} onPress={() => onItem(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}><Icon name="package" color={days !== null && days < 0 ? colors.danger : colors.accent} /><View style={{ flex: 1, gap: 4, minWidth: 0 }}><Text style={s.label} numberOfLines={1}>{item.name}</Text><Text style={s.muted} numberOfLines={1}>{path(item)}</Text><Text style={s.muted} numberOfLines={1}>{categoryName(item.categoryId, item.subcategoryId)}</Text><InventorySummary item={item} /></View><Text style={[statusStyle, { maxWidth: 95 }]}>{status}</Text></Pressable>{actions && <InventoryActions item={item} {...actions} />}</View>;
  })}</View>;
}

type ExpiryFilter = Exclude<Filter, 'all'>;

function ExpiryStatCard({ filter, count, tone, selected, hasSelection, onPress }: { filter: Filter; count: number; tone: StyleProp<ViewStyle>; selected: boolean; hasSelection: boolean; onPress: () => void }) {
  const motion = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const target = selected ? 1 : hasSelection ? -1 : 0;
    const animation = Animated.spring(motion, { toValue: target, useNativeDriver: Platform.OS !== 'web', tension: 190, friction: 17 });
    animation.start();
    return () => animation.stop();
  }, [hasSelection, motion, selected]);
  const scale = motion.interpolate({ inputRange: [-1, 0, 1], outputRange: [.96, 1, 1.06] });
  const opacity = motion.interpolate({ inputRange: [-1, 0, 1], outputRange: [.78, 1, 1] });
  return <Animated.View testID={`expiry-card-${filter}`} style={[s.statCard, tone, { opacity, zIndex: selected ? 2 : 1, transform: [{ scale }] }]}>
    <Pressable {...({ 'aria-pressed': selected } as any)} accessibilityRole="button" accessibilityLabel={`${filterLabels[filter]} ${count}`} accessibilityState={{ selected }} onPress={onPress} style={{ flex: 1, width: '100%', justifyContent: 'center', gap: 3 }}>
      <Text style={s.statLabel}>{filterLabels[filter]}</Text><Text style={s.statValue}>{count}</Text>
    </Pressable>
  </Animated.View>;
}

function ExpiryItemsPanel({ filter, items, renderItems, now }: { filter: ExpiryFilter; items: Item[]; renderItems: (items: Item[]) => React.ReactNode; now: Date }) {
  const motion = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    motion.setValue(0);
    const animation = Animated.timing(motion, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [filter, motion]);
  const translateY = motion.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return <Animated.View key={filter} testID={`expiry-items-panel-${filter}`} style={[s.expiryItemsPanel, { opacity: motion, transform: [{ translateY }] }]}><Text style={s.h2}>到期物品 · {filterLabels[filter]}</Text>{renderItems(filterItems(items, filter, undefined, now))}</Animated.View>;
}

export function HomePage({ home, items, query, setQuery, searchResults, onHomes, onOpenAllItems, onAdd, onSaveCopy, renderItems, now, inventoryReminders }: { home: Home; items: Item[]; query: string; setQuery: (q: string) => void; searchResults: Item[]; onHomes: () => void; onOpenAllItems: () => void; onAdd: () => void; onSaveCopy: (greeting: string, note: string) => void; renderItems: (items: Item[]) => React.ReactNode; now: Date; inventoryReminders?: React.ReactNode }) {
  const counts = statistics(items, now);
  const [editingCopy, setEditingCopy] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<Exclude<Filter, 'all'>>();
  const scale = useRef(new Animated.Value(1)).current;
  const [greeting, setGreeting] = useState(home.greeting ?? DEFAULT_HOME_GREETING);
  const [note, setNote] = useState(home.note ?? DEFAULT_HOME_NOTE);
  React.useEffect(() => { setGreeting(home.greeting ?? DEFAULT_HOME_GREETING); setNote(home.note ?? DEFAULT_HOME_NOTE); }, [home.id, home.greeting, home.note]);
  React.useEffect(() => { setExpandedFilter(undefined); }, [home.id]);
  const animateBack = () => Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', tension: 180, friction: 16 }).start();
  const openCopyEditor = () => { animateBack(); setTimeout(() => setEditingCopy(true), 180); };
  const startPress = () => Animated.timing(scale, { toValue: 1.04, duration: 450, useNativeDriver: Platform.OS !== 'web' }).start();
  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Animated.View style={[s.welcome, s.headingRow, { transform: [{ scale }] }]}>
      <Pressable {...({ onContextMenu: openCopyEditor } as any)} accessibilityRole="button" accessibilityLabel="编辑首页问候语" onPressIn={startPress} onPressOut={animateBack} onLongPress={openCopyEditor} delayLongPress={500} style={StyleSheet.absoluteFill} />
      <View style={s.welcomeCopy} pointerEvents="box-none"><Pressable accessibilityRole="button" accessibilityLabel="选择家庭" onPress={onHomes} style={s.row}><Text style={s.welcomeHome}>{home.name}</Text><Icon name="chevron-down" color={colors.surface} /></Pressable><View pointerEvents="none"><Text style={s.welcomeGreeting}>{home.greeting ?? DEFAULT_HOME_GREETING}</Text><Text style={s.welcomeNote}>{home.note ?? DEFAULT_HOME_NOTE}</Text></View></View>
      <View pointerEvents="none"><Mascot source={require('../assets/cat-mascot.png')} size={104} /></View>
    </Animated.View>
    <Button title="记录物品" icon="plus" onPress={onAdd} />
    <View style={s.searchWrap}><Icon name="search" color={colors.muted} /><TextInput accessibilityLabel="搜索所有家的物品" placeholder="搜索物品、分类或位置" value={query} onChangeText={setQuery} style={[s.input, s.searchInput]} /></View>
    {!query.trim() && <><Text style={s.h2}>到期提醒</Text><View testID="expiry-stats-grid" style={s.statsGrid}>{(Object.keys(filterLabels) as Filter[]).map(filter => { const tone = filter === 'all' ? s.statHoney : filter === 'month' ? s.statPeach : filter === 'week' ? s.statGreen : s.statTerracotta; const isSelected = filter !== 'all' && expandedFilter === filter; return <ExpiryStatCard key={filter} filter={filter} count={counts[filter]} tone={tone} selected={isSelected} hasSelection={!!expandedFilter} onPress={() => filter === 'all' ? onOpenAllItems() : setExpandedFilter(current => current === filter ? undefined : filter)} />; })}</View>{expandedFilter && <ExpiryItemsPanel key={expandedFilter} filter={expandedFilter} items={items} renderItems={renderItems} now={now} />}</>}
    {!!query.trim() && <><Text style={s.h2}>搜索结果 · {searchResults.length}</Text>{renderItems(searchResults)}</>}
    {!query.trim() && inventoryReminders}
    {editingCopy && <Sheet title="编辑首页文案" onClose={() => { setEditingCopy(false); animateBack(); }}><Field label="主标题" value={greeting} onChangeText={setGreeting} placeholder={DEFAULT_HOME_GREETING} /><Field label="副标题" value={note} onChangeText={setNote} placeholder={DEFAULT_HOME_NOTE} /><Button title="保存文案" onPress={() => { onSaveCopy(greeting.trim() || DEFAULT_HOME_GREETING, note.trim() || DEFAULT_HOME_NOTE); setEditingCopy(false); animateBack(); }} /><Button title="取消" secondary onPress={() => { setEditingCopy(false); animateBack(); }} /></Sheet>}
  </ScrollView>;
}
export function Grid({ children, items, layout = { rows: 8, cols: 8 }, preview = false, onContainer, onItem, editingId, draftCells, onToggleCell }: { children: Container[]; items: Item[]; layout?: Room['layout']; preview?: boolean; onContainer?: (id: string) => void; onItem?: (item: Item) => void; editingId?: string; draftCells?: number[]; onToggleCell?: (cell: number) => void }) {
  const [width, setWidth] = useState(0);
  const painted = useRef(new Set<number>());
  const size = width / layout.cols;
  const paintAt = (x: number, y: number) => { if (!editingId || painted.current.has(cellAt(x, y, width, width * layout.rows / layout.cols, layout.rows, layout.cols) ?? -1)) return; const cell = cellAt(x, y, width, width * layout.rows / layout.cols, layout.rows, layout.cols); if (cell === null) return; painted.current.add(cell); onToggleCell?.(cell); };
  return <View testID={preview ? 'grid-preview' : 'layout-grid'} onLayout={e => setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponderCapture={() => !!editingId} onResponderGrant={e => { painted.current.clear(); paintAt(e.nativeEvent.locationX, e.nativeEvent.locationY); }} onResponderMove={e => paintAt(e.nativeEvent.locationX, e.nativeEvent.locationY)} onResponderRelease={() => painted.current.clear()} style={{ width: '100%', aspectRatio: layout.cols / layout.rows, backgroundColor: colors.gridEmpty, overflow: 'hidden' }}>
    {width > 0 && Array.from({ length: layout.rows * layout.cols }, (_, cell) => {
      const child = children.find(c => c.cells.includes(cell)); const item = items.find(i => i.cell === cell); const editing = !!editingId; const selected = !!draftCells?.includes(cell);
      return <Pressable key={cell} testID={preview ? undefined : `cell-${cell}`} accessibilityRole={!preview && (child || item || editing) ? 'button' : undefined} accessibilityLabel={editing ? `编辑第 ${cell + 1} 格` : child ? `进入模块 ${child.name}` : item ? `查看物品 ${item.name}` : undefined} disabled={preview || (!editing && !child && !item)} onPress={() => editing ? onToggleCell?.(cell) : child ? onContainer?.(child.id) : item && onItem?.(item)} style={{ position: 'absolute', left: (cell % layout.cols) * size, top: Math.floor(cell / layout.cols) * size, width: size, height: size, borderWidth: .5, borderColor: colors.line, backgroundColor: editing && selected ? normalizeModuleColor(child?.color) : child ? normalizeModuleColor(child.color) : item ? colors.peachSoft : colors.gridEmpty, padding: preview ? 0 : 2, justifyContent: 'center', overflow: 'hidden' }}>
        {!preview && <Text numberOfLines={2} style={{ fontSize: 10, textAlign: 'center', color: colors.ink }}>{child?.cells[0] === cell ? child.name : item?.name}</Text>}
      </Pressable>;
    })}
  </View>;
}
export function RoomsPage({ home, rooms, items, containers, onOpen, onCreate, onRename, onDelete }: { home: Home; rooms: Room[]; items: Item[]; containers: Container[]; onOpen: (id: string) => void; onCreate: () => void; onRename: (room: Room) => void; onDelete: (room: Room) => void }) {
  return <ScrollView contentContainerStyle={s.page}><View style={s.headingRow}><View style={{ gap: 4 }}><Text style={s.title}>房间</Text><Text style={s.muted}>{home.name} · 把每个角落都放回它该在的地方</Text></View><Icon name="home" color={colors.accent} /></View>
    {!rooms.length && <Empty text="这个家还没有房间" />}
    <View style={s.roomGrid}>{rooms.map(room => <View key={room.id} style={s.roomCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`打开房间 ${room.name}`} onPress={() => onOpen(room.id)} style={{ gap: 12 }}><View style={s.roomPreview}><Grid layout={room.layout} preview children={directChildren(containers, room.id)} items={directItems(items, room.id)} /></View><View style={s.roomCardHeader}><Text style={s.roomCardTitle}>{room.name}</Text><Text style={s.roomCardMeta}>{room.layout.rows}×{room.layout.cols} · {items.filter(i => i.roomId === room.id).length} 条记录 · 点击进入</Text></View></Pressable>
      <View style={s.roomCardActions}><IconButton name="edit-2" label={`重命名房间 ${room.name}`} onPress={() => onRename(room)} /><IconButton name="trash-2" label={`删除房间 ${room.name}`} onPress={() => onDelete(room)} /></View>
    </View>)}</View><Button title="新增房间" icon="plus" onPress={onCreate} />
  </ScrollView>;
}
export function LayoutPage({ room, location, containers, items, path, onBack, onEnter, onItem, onAdd, onCreateContainer, onRenameContainer, onDeleteContainer, onUpdateContainerCells, onDelete, renderItems }: { room: Room; location: Location; containers: Container[]; items: Item[]; path: string; onBack: () => void; onEnter: (id: string) => void; onItem: (item: Item) => void; onAdd: () => void; onCreateContainer: () => void; onRenameContainer: (container: Container) => void; onDeleteContainer: (container: Container) => void; onUpdateContainerCells: (id: string, cells: number[]) => string | null; onDelete: () => void; renderItems: (items: Item[]) => React.ReactNode }) {
  const [editingId, setEditingId] = useState<string>();
  const [draftCells, setDraftCells] = useState<number[]>([]);
  const current = containers.find(c => c.id === location.containerId);
  const isTerminal = current?.level === 3;
  const children = directChildren(containers, room.id, location.containerId);
  const contents = directItems(items, room.id, location.containerId);
  return <ScrollView scrollEnabled={!editingId} contentContainerStyle={s.page}><View style={s.headingRow}><IconButton name="arrow-left" label="返回上一级" onPress={onBack} /><Text style={[s.h2, { flex: 1 }]}>{editingId ? `编辑布局 · ${children.find(c => c.id === editingId)?.name ?? ''}` : current?.name ?? room.name}</Text>{!editingId && (current ? <View style={s.row}><IconButton name="edit-2" label={`重命名模块 ${current.name}`} onPress={() => onRenameContainer(current)} /><IconButton name="trash-2" label={`删除模块 ${current.name}`} onPress={() => onDeleteContainer(current)} /></View> : <IconButton name="trash-2" label="删除房间" onPress={onDelete} />)}</View>
    <Text style={s.muted}>{path} · {room.layout.rows}×{room.layout.cols}</Text>{editingId ? <GridEditor layout={room.layout} initialCells={[...new Set(draftCells)]} blockedCells={[...occupiedCellsForContainer(editingId, containers, items)]} color={containers.find(c => c.id === editingId)?.color} onSave={cells => { const message = onUpdateContainerCells(editingId, cells); if (!message) setEditingId(undefined); return message; }} onCancel={() => setEditingId(undefined)} /> : !isTerminal && <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}><Grid layout={room.layout} children={children} items={contents} onContainer={onEnter} onItem={onItem} /></View>}
    {editingId ? null : children.map(child => <View key={child.id} style={s.moduleCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`打开模块 ${child.name}`} onPress={() => onEnter(child.id)} style={s.moduleNameRow}>
        <View accessibilityLabel={`模块颜色 ${normalizeModuleColor(child.color)}`} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: normalizeModuleColor(child.color), borderWidth: 1, borderColor: colors.line }} />
        <Icon name="archive" />
        <Text style={[s.label, s.moduleName]} numberOfLines={1} ellipsizeMode="tail">{child.name}</Text>
        <Icon name="chevron-right" />
      </Pressable>
      <View style={s.moduleActions}>
        <Button title="编辑布局" icon="grid" secondary onPress={() => { setEditingId(child.id); setDraftCells(child.cells); }} />
        <IconButton name="edit-2" label={`重命名模块 ${child.name}`} onPress={() => onRenameContainer(child)} />
        <IconButton name="trash-2" label={`删除模块 ${child.name}`} onPress={() => onDeleteContainer(child)} />
      </View>
    </View>)}
    {!editingId && <><Text style={s.h2}>直属物品</Text>{renderItems(contents)}<Button title="在此位置记录物品" icon="plus" onPress={onAdd} />{(!current || current.level < 3) && <Button title="新增模块" icon="archive" secondary onPress={onCreateContainer} />}</>}
  </ScrollView>;
}
