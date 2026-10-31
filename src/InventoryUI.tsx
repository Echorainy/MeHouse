import { ItemImage } from './ItemImage';
import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { localDate, parseDate, remainingDays, type Item } from './domain';
import { inventoryLabel, needsMaintenance, needsRestock, parseCount, type InventoryType } from './inventory';
import { Button, Chip, Field, Sheet, colors, s } from './ui';

export function InventoryDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}><Text style={s.label}>{label}</Text>{Platform.OS === 'web'
    ? <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" style={s.input} />
    : <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={s.input}><Text style={s.label}>{value || '选择日期'}</Text></Pressable>}
    {open && Platform.OS !== 'web' && <DateTimePicker value={parseDate(value) ?? new Date()} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, date) => { if (Platform.OS !== 'ios') setOpen(false); if (date) onChange(localDate(date)); }} />}
  </View>;
}
export type InventoryDraft = { inventoryType: InventoryType; quantity: string; unit: string; threshold: string; maintenance: boolean; date: string; lead: string };
export function inventoryDraft(item?: Item): InventoryDraft {
  return { inventoryType: item?.inventoryType ?? null, quantity: String(item?.quantity ?? 1), unit: item?.unit ?? '份', threshold: String(item?.restockThreshold ?? 1), maintenance: !!item?.maintenanceDate, date: item?.maintenanceDate ?? '', lead: String(item?.maintenanceLeadDays ?? 7) };
}
export function InventoryEditor({ draft, onChange }: { draft: InventoryDraft; onChange: (draft: InventoryDraft) => void }) {
  const update = (patch: Partial<InventoryDraft>) => onChange({ ...draft, ...patch });
  return <View style={s.itemFormSection} testID="item-form-inventory"><Text style={s.label}>库存类型</Text><View style={s.wrap}>
    <Chip label="消耗品" selected={draft.inventoryType === 'consumable'} onPress={() => update({ inventoryType: 'consumable' })} />
    <Chip label="耐用品" selected={draft.inventoryType === 'durable'} onPress={() => update({ inventoryType: 'durable' })} />
  </View><View style={s.row}><Field label="数量" value={draft.quantity} onChangeText={quantity => update({ quantity })} numeric containerStyle={{ flex: 1, minWidth: 0 }} /><Field label="单位" value={draft.unit} onChangeText={unit => update({ unit })} containerStyle={{ flex: 1, minWidth: 0 }} /></View>
    {draft.inventoryType === 'consumable' && <><Field label="库存线" value={draft.threshold} onChangeText={threshold => update({ threshold })} numeric /><Text style={s.muted}>数量低于库存线时提醒补货，每次消耗 1 {draft.unit || '份'}。</Text></>}
    {draft.inventoryType === 'durable' && <><Text style={s.label}>检修计划</Text><View style={s.wrap}><Chip label="不设置检修" selected={!draft.maintenance} onPress={() => update({ maintenance: false })} /><Chip label="设置检修" selected={draft.maintenance} onPress={() => update({ maintenance: true })} /></View>{draft.maintenance && <><InventoryDateField label="检修日期" value={draft.date} onChange={date => update({ date })} /><Field label="提前提醒天数" value={draft.lead} onChangeText={lead => update({ lead })} numeric /></>}</>}
  </View>;
}
export type InventoryCallbacks = { onConsume: (item: Item) => void; onRestock: (item: Item) => void; onMaintain: (item: Item) => void };
export function InventoryActions({ item, onConsume, onRestock, onMaintain }: InventoryCallbacks & { item: Item }) {
  if (item.inventoryType === 'consumable') return <View style={s.wrap}><Button title="消耗一份" label={`消耗一份 ${item.name}`} secondary disabled={item.quantity <= 0} onPress={() => onConsume(item)} /><Button title="补货" label={`补货 ${item.name}`} secondary onPress={() => onRestock(item)} /></View>;
  if (item.inventoryType === 'durable' && item.maintenanceDate) return <Button title="完成检修" label={`完成检修 ${item.name}`} secondary disabled={item.quantity <= 0} onPress={() => onMaintain(item)} />;
  return null;
}
export function InventorySummary({ item }: { item: Item }) {
  return <Text style={s.muted}>{inventoryLabel(item)} · {item.quantity} {item.unit}{item.quantity === 0 ? ' · 已用完' : ''}</Text>;
}
export function InventoryReminders({ items, now, path, onItem, ...actions }: InventoryCallbacks & { items: Item[]; now: Date; path: (item: Item) => string; onItem: (item: Item) => void }) {
  const restock = items.filter(needsRestock).sort((a, b) => a.quantity - b.quantity);
  const maintenance = items.filter(item => needsMaintenance(item, now)).sort((a, b) => a.maintenanceDate!.localeCompare(b.maintenanceDate!));
  return <>{(['restock', 'maintenance'] as const).map(kind => {
    const records = kind === 'restock' ? restock : maintenance;
    return <View key={kind} testID={`${kind}-reminders`} style={s.sectionCard}><Text style={s.h2}>{kind === 'restock' ? '补货提醒' : '检修提醒'} · {records.length} 条记录</Text>
      {!records.length && <Text style={s.muted}>{kind === 'restock' ? '暂无需要补货的物品' : '暂无待检修物品'}</Text>}
      {records.map(item => {
        const days = remainingDays(item.maintenanceDate, now) ?? 0;
        const urgent = kind === 'restock' ? item.quantity === 0 : days < 0;
        return <View key={item.id} testID={`${kind}-${item.id}`} style={s.card}><Pressable accessibilityRole="button" accessibilityLabel={`查看物品 ${item.name}`} onPress={() => onItem(item)} style={{ gap: 8, minHeight: 48 }}><View style={s.row}><ItemImage uri={item.imageUri} /><Text style={[s.label, { flex: 1 }]}>{item.name}</Text></View><Text style={s.muted}>{path(item)}</Text><InventorySummary item={item} /></Pressable>
          <Text style={[s.muted, { color: urgent ? '#A34E32' : '#80602C' }]}>{kind === 'restock' ? `库存线 ${item.restockThreshold} ${item.unit} · ${item.quantity === 0 ? '已用完' : '库存不足'}` : days < 0 ? `已逾期 ${-days} 天` : days === 0 ? '今天检修' : `还有 ${days} 天检修`}</Text>
          <InventoryActions item={item} {...actions} />
        </View>;
      })}</View>;
  })}</>;
}
export function InventoryActionSheet({ item, kind, onClose, onSave }: { item: Item; kind: 'restock' | 'maintenance'; onClose: () => void; onSave: (value: number | string | undefined) => string | null }) {
  const [amount, setAmount] = useState('1'); const [next, setNext] = useState(''); const [error, setError] = useState('');
  const save = () => {
    if (kind === 'restock') {
      const count = parseCount(amount);
      if (count === null || count === 0 || !Number.isSafeInteger(item.quantity + count)) return setError('补货数量必须是有效正整数');
      const message = onSave(count); if (message) setError(message);
    } else {
      if (next && (!parseDate(next) || remainingDays(next)! <= 0)) return setError('下一次检修日期必须是今天之后的有效日期');
      const message = onSave(next || undefined); if (message) setError(message);
    }
  };
  return <Sheet title={`${kind === 'restock' ? '补货' : '完成检修'} · ${item.name}`} onClose={onClose}><InventorySummary item={item} />
    {kind === 'restock' ? <><Text style={s.muted}>只增加本条记录的数量，共用原位置和过期日期。不同过期日期请新建记录。</Text><Field label="增加数量" value={amount} onChangeText={setAmount} numeric /></>
      : <View style={{ gap: 12, marginVertical: 12 }}><Text style={s.muted}>确认后记录今天为完成日期。可填写下一次日期，留空则结束本次计划。</Text><InventoryDateField label="下一次检修日期（可选）" value={next} onChange={setNext} /></View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={kind === 'restock' ? '确认补货' : '确认完成检修'} onPress={save} />
  </Sheet>;
}


