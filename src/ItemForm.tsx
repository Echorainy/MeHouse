import { InventoryEditor, inventoryDraft } from './InventoryUI';
import { parseCount, validateInventory, normalizeInventory } from './inventory';
import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Category, Container, Item, Location, Room, Subcategory, directChildren, localDate, parseDate } from './domain';
import { Button, Chip, Field, Sheet, colors, s } from './ui';

export function ItemForm({ rooms, containers, categories, subcategories, initialLocation, item, onClose, onSave }: { rooms: Room[]; containers: Container[]; categories: Category[]; subcategories: Subcategory[]; initialLocation?: Location; item?: Item; onClose: () => void; onSave: (item: Omit<Item, 'id'>, id?: string) => string | null }) {
  const [inventory, setInventory] = useState(() => inventoryDraft(item));
  const [name, setName] = useState(item?.name ?? ''); const [categoryId, setCategoryId] = useState(item?.categoryId ?? 'uncategorized'); const [subcategoryId, setSubcategoryId] = useState(item?.subcategoryId);
  const [place, setPlace] = useState<Location | undefined>(item ? { roomId: item.roomId, containerId: item.containerId } : initialLocation);
  const [withExpiry, setWithExpiry] = useState(!!item?.expiry); const [mode, setMode] = useState<'direct' | 'calculated'>('direct');
  const [date, setDate] = useState(item?.expiry ?? ''); const [production, setProduction] = useState(''); const [days, setDays] = useState(''); const [error, setError] = useState(''); const [picker, setPicker] = useState<'expiry' | 'production'>();
  const pickerValue = (value: string) => parseDate(value) ?? new Date();
  const dateField = (label: string, value: string, kind: 'expiry' | 'production', onChange: (value: string) => void) => <>{Platform.OS === 'web' ? <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor="#A89078" style={s.input} /> : <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setPicker(kind)} style={s.input}><Text style={{ color: value ? colors.ink : colors.muted }}>{value || '选择日期'}</Text></Pressable>}{picker === kind && Platform.OS !== 'web' && <DateTimePicker value={pickerValue(value)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, selected) => { if (Platform.OS !== 'ios') setPicker(undefined); if (selected) onChange(localDate(selected)); }} />}</>;
  const save = () => {
    if (!name.trim()) return setError('请填写物品名称');
    if (!place || !rooms.some(r => r.id === place.roomId)) return setError('请选择房间');
    let expiry: string | undefined;
    if (withExpiry) {
      if (mode === 'direct') { if (!parseDate(date)) return setError('请输入有效的过期日期，例如 2026-12-31'); expiry = date; }
      else {
        const start = parseDate(production); const length = Number(days);
        if (!start || !Number.isInteger(length) || length <= 0 || length > 36500) return setError('请填写有效生产日期和 1–36500 的整数天数');
        start.setDate(start.getDate() + length); expiry = localDate(start);
      }
    }
    const inventoryFields = {
      inventoryType: inventory.inventoryType, quantity: parseCount(inventory.quantity) ?? NaN, unit: inventory.unit.trim(),
      restockThreshold: parseCount(inventory.threshold) ?? NaN,
      maintenanceDate: inventory.maintenance ? inventory.date : undefined,
      maintenanceLeadDays: parseCount(inventory.lead) ?? NaN, lastMaintenanceDate: item?.lastMaintenanceDate,
    };
    if (inventory.inventoryType === 'durable' && inventory.maintenance && !inventory.date) return setError('请选择检修日期');
    const inventoryError = validateInventory(inventoryFields, !!item && !item.inventoryType && !inventory.inventoryType);
    if (inventoryError) return setError(inventoryError);
    const selectedSubcategory = subcategories.some(subcategory => subcategory.id === subcategoryId && subcategory.parentCategoryId === categoryId) ? subcategoryId : undefined;
    const message = onSave({ ...normalizeInventory(inventoryFields), name: name.trim(), categoryId, subcategoryId: selectedSubcategory, ...place, expiry, reminderDays: item?.reminderDays ?? 7, cell: item?.cell }, item?.id);
    if (message) setError(message);
  };
  const moduleOptions = place ? directChildren(containers, place.roomId) : [];
  const selected = containers.find(c => c.id === place?.containerId);
  const parentId = selected?.level === 3 ? selected.parentId : selected?.id;
  const children = place && parentId ? directChildren(containers, place.roomId, parentId) : [];
  const categoryChildren = subcategories.filter(subcategory => subcategory.parentCategoryId === categoryId);
  const selectCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setSubcategoryId(current => subcategories.some(subcategory => subcategory.id === current && subcategory.parentCategoryId === nextCategoryId) ? current : undefined);
  };
  return <Sheet title={item ? '编辑物品' : '记录物品'} onClose={onClose}>
    <View testID="item-form-stack" style={s.itemFormStack}>
      <View style={s.itemFormSection}><Field label="物品名称" value={name} onChangeText={setName} containerStyle={s.itemFormField} /></View>
      <InventoryEditor draft={inventory} onChange={setInventory} />
      <View testID="item-form-section-room" style={s.itemFormSection}><Text style={s.label}>房间</Text><View style={s.wrap}>{rooms.map(room => <Chip key={room.id} label={room.name} tone="room" selected={place?.roomId === room.id} onPress={() => setPlace({ roomId: room.id })} />)}</View></View>
      {place && <View testID="item-form-section-location" style={s.itemFormSection}><Text style={s.label}>存放位置</Text><View style={s.itemFormSubsection}><View style={s.wrap}><Chip label="直接放在房间" tone="neutral" selected={!place.containerId} onPress={() => setPlace({ roomId: place.roomId })} />{moduleOptions.map(c => <Chip key={c.id} label={c.name} tone="module" selected={parentId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>{!!children.length && <View style={s.wrap}>{children.map(c => <Chip key={c.id} label={c.name} tone="submodule" selected={place.containerId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>}</View></View>}
      <View testID="item-form-section-category" style={s.itemFormSection}><Text style={s.label}>分类标签</Text><View style={s.wrap}>{categories.map(c => <Chip key={c.id} label={c.name} variant="primaryCategory" selected={categoryId === c.id} onPress={() => selectCategory(c.id)} />)}</View>{!!categoryChildren.length && <View style={s.itemFormSubsection}><Text style={s.label}>二级分类（可选）</Text><View style={s.wrap}><Chip label="仅一级分类" variant="secondaryCategory" selected={!subcategoryId} onPress={() => setSubcategoryId(undefined)} />{categoryChildren.map(subcategory => <Chip key={subcategory.id} label={subcategory.name} variant="secondaryCategory" selected={subcategoryId === subcategory.id} onPress={() => setSubcategoryId(subcategory.id)} />)}</View></View>}</View>
      <View testID="item-form-section-expiry" style={s.itemFormSection}><Text style={s.label}>保质期</Text><View style={s.wrap}><Chip label="不设置保质期" selected={!withExpiry} onPress={() => setWithExpiry(false)} /><Chip label="设置保质期" selected={withExpiry} onPress={() => setWithExpiry(true)} /></View>{withExpiry && <View style={s.itemFormSubsection}><View style={s.wrap}><Chip label="选择过期日" selected={mode === 'direct'} onPress={() => setMode('direct')} /><Chip label="生产日期 + 天数" selected={mode === 'calculated'} onPress={() => setMode('calculated')} /></View>{mode === 'direct' ? <View style={s.itemFormFieldGroup}><Text style={s.label}>过期日期</Text>{dateField('过期日期', date, 'expiry', setDate)}</View> : <><View style={s.itemFormFieldGroup}><Text style={s.label}>生产日期</Text>{dateField('生产日期', production, 'production', setProduction)}</View><Field label="保质期天数" value={days} onChangeText={setDays} numeric containerStyle={s.itemFormField} /></>}</View>}</View>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={item ? '保存修改' : '保存物品'} onPress={save} />
    </View>
  </Sheet>;
}
