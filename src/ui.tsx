import React, { useEffect, useState } from 'react';
import { AppState, Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LOCATION_TONES, LocationTone, localDate } from './domain';
export type IconName = React.ComponentProps<typeof Feather>['name'];
export const colors = {
  ink: '#3D220F', muted: '#806C58', line: '#E8DCCB', accent: '#708B72', soft: '#EAF0E5', danger: '#C86D57',
  background: '#F8F3E9', surface: '#FFFAF4', honey: '#D9A15B', honeyLight: '#E7B56F', peach: '#F9B393', peachSoft: '#F4D6C7', cat: '#FFD093', catWhite: '#FFFAF4',
  gridEmpty: '#FCF8F0', gridBlocked: '#E8EDE7',
};
export const layoutInsets = { contentTop: 32, navBottom: 12 };
export function Icon({ name, color = colors.ink }: { name: IconName; color?: string }) { return <Feather name={name} size={20} color={color} />; }
export function IconButton({ name, label, onPress }: { name: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.iconButton}><Icon name={name} /></Pressable>;
}
export function Button({ title, label, onPress, secondary = false, icon, disabled = false }: { title: string; label?: string; onPress: () => void; secondary?: boolean; icon?: IconName; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: .4 }]}>{icon && <Icon name={icon} color={secondary ? colors.accent : '#FFF'} />}<Text style={[s.buttonText, secondary && { color: colors.accent }]}>{title}</Text></Pressable>;
}
export function Chip({ label, selected, onPress, tone, variant, interactive = true }: { label: string; selected: boolean; onPress: () => void; tone?: LocationTone; variant?: 'primaryCategory' | 'secondaryCategory'; interactive?: boolean }) {
  const palette = tone ? LOCATION_TONES[tone] : undefined;
  const variantStyle = variant === 'primaryCategory' ? s.categoryPrimaryChip : undefined;
  const variantSelectedStyle = variant === 'primaryCategory' ? s.categoryPrimarySelected : variant === 'secondaryCategory' ? s.categorySecondarySelected : undefined;
  const textColor = selected && tone ? palette!.text : variant === 'secondaryCategory' && selected ? LOCATION_TONES.submodule.text : colors.ink;
  const style = [s.chip, variantStyle, tone && { borderColor: palette!.border }, selected && (variantSelectedStyle ?? (tone ? { backgroundColor: palette!.background, borderColor: palette!.border } : s.chipSelected))];
  const content = <Text style={{ color: textColor, fontWeight: selected ? '700' : '400' }}>{label}</Text>;
  if (!interactive) return <View accessibilityLabel={label} style={style}>{content}</View>;
  return <Pressable {...({ 'aria-checked': selected } as any)} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={onPress} style={style}>{content}</Pressable>;
}
export function FilterGroup({ title, summary, defaultExpanded = false, children }: { title: string; summary: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? '收起' : '展开'}${title}筛选`} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={s.label}>{title}</Text><Text numberOfLines={1} style={[s.muted, { flex: 1, minWidth: 0, textAlign: 'right' }]}>{summary}</Text><Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
    </Pressable>
    {expanded && <View style={{ gap: 12 }}>{children}</View>}
  </View>;
}
export function Field({ label, value, onChangeText, placeholder, numeric = false, containerStyle }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; numeric?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  return <View style={[s.field, containerStyle]}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#81918A" keyboardType={numeric ? 'number-pad' : 'default'} /></View>;
}
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.sheet} accessibilityViewIsModal><View style={s.headingRow}><Text style={s.h2}>{title}</Text><IconButton name="x" label="关闭弹窗" onPress={onClose} /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>{children}</ScrollView></View></View></Modal>;
}
export function Empty({ text }: { text: string }) { return <View style={s.empty}><Mascot source={require('../assets/cat-mascot-resting.png')} size={96} /><Text style={s.emptyTitle}>这里还空着</Text><Text style={s.muted}>{text}</Text></View>; }
export function Mascot({ source, size = 96 }: { source?: ImageSourcePropType; size?: number }) {
  if (source) return <Image accessibilityLabel="猫咪助手" source={source} resizeMode="contain" style={{ width: size, height: size }} />;
  const ear = size * .24;
  return <View accessibilityLabel="猫咪助手" style={[s.mascot, { width: size, height: size * 1.04 }]}>
    <View style={[s.mascotEar, s.mascotEarLeft, { width: ear, height: ear }]} />
    <View style={[s.mascotEar, s.mascotEarRight, { width: ear, height: ear }]} />
    <View style={[s.mascotHead, { width: size * .72, height: size * .57, borderRadius: size * .28 }]}>
      <View style={[s.mascotEye, { left: size * .2, top: size * .25 }]} />
      <View style={[s.mascotEye, { right: size * .2, top: size * .25 }]} />
      <View style={[s.mascotNose, { top: size * .36 }]} />
    </View>
    <View style={[s.mascotBody, { width: size * .66, height: size * .46, borderRadius: size * .22 }]}><View style={[s.mascotBelly, { width: size * .34, height: size * .22, borderRadius: size * .12 }]} /></View>
  </View>;
}
export function useToday() {
  const [today, setToday] = useState(() => localDate());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer); setToday(localDate());
      const now = new Date(); const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, Math.max(1, next.getTime() - now.getTime() + 100));
    };
    refresh(); const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); listener.remove(); };
  }, []);
  return new Date(`${today}T00:00:00`);
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: layoutInsets.contentTop },
  page: { padding: 20, gap: 18, paddingBottom: 32 }, title: { fontSize: 28, fontWeight: '700', color: colors.ink, flexShrink: 1, letterSpacing: 0 }, h2: { fontSize: 18, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink }, muted: { color: colors.muted, fontSize: 13, lineHeight: 20 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { gap: 8, marginVertical: 10 }, input: { minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.ink },
  button: { minHeight: 48, padding: 12, borderRadius: 16, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 4 }, buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15, flexShrink: 1 }, secondary: { backgroundColor: colors.soft },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, chip: { minHeight: 40, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, chipSelected: { borderColor: colors.accent, backgroundColor: colors.soft }, categoryPrimaryChip: { borderColor: colors.accent, backgroundColor: colors.surface }, categoryPrimarySelected: { borderColor: colors.accent, backgroundColor: colors.soft }, categorySecondaryChip: { borderColor: LOCATION_TONES.submodule.border, backgroundColor: LOCATION_TONES.submodule.background }, categorySecondarySelected: { borderWidth: 2, borderColor: LOCATION_TONES.submodule.border, backgroundColor: LOCATION_TONES.submodule.background },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 }, itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface }, moduleCard: { padding: 12, marginBottom: 10, gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface }, moduleNameRow: { minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }, moduleName: { flex: 1, minWidth: 0 }, moduleActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 2, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 },
  empty: { alignItems: 'center', padding: 28, gap: 8 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, backdrop: { flex: 1, backgroundColor: 'rgba(61,34,15,.34)', alignItems: 'center', justifyContent: 'center', padding: 16 }, sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: colors.background, borderRadius: 20, padding: 16 }, error: { color: colors.danger, marginVertical: 8 }, statusNormal: { alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.soft, color: colors.accent, fontSize: 12, fontWeight: '600' }, statusSoon: { alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.peachSoft, color: colors.ink, fontSize: 12, fontWeight: '600' }, statusExpired: { alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#F0C5B4', color: colors.danger, fontSize: 12, fontWeight: '700' },
  nav: { flexDirection: 'row', paddingBottom: layoutInsets.navBottom, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line }, navItem: { flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: 5 }, navLabel: { fontSize: 12, color: colors.muted },
  welcome: { backgroundColor: colors.accent, borderRadius: 24, borderWidth: 0, padding: 24, minHeight: 214, overflow: 'hidden' }, welcomeExpanded: { minHeight: 270, padding: 30 }, welcomeCopy: { flex: 1, gap: 8, paddingRight: 8 }, welcomeHome: { color: colors.surface, fontSize: 20, fontWeight: '700', flexShrink: 1 }, welcomeGreeting: { color: colors.surface, fontSize: 27, lineHeight: 34, fontWeight: '800', maxWidth: 220 }, welcomeNote: { color: '#E6EEE4', fontSize: 13, lineHeight: 20 }, searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingLeft: 14 }, searchInput: { flex: 1, minHeight: 48, paddingHorizontal: 0, borderWidth: 0 }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, statCard: { width: '48%', minHeight: 74, padding: 14, borderRadius: 18, gap: 3, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, statHoney: { backgroundColor: colors.honeyLight, borderColor: colors.honeyLight }, statPeach: { backgroundColor: colors.peachSoft, borderColor: colors.peachSoft }, statTerracotta: { backgroundColor: '#C27454', borderColor: '#C27454' }, statGreen: { backgroundColor: '#DDE8DA', borderColor: '#DDE8DA' }, statSurface: { backgroundColor: colors.surface }, statLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' }, statValue: { fontSize: 28, fontWeight: '800', color: colors.ink },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: '4%' }, roomCard: { width: '48%', minWidth: 0, padding: 12, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 }, roomPreview: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#FCF8F0', borderWidth: 1, borderColor: colors.line }, roomCardHeader: { gap: 4 }, roomCardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, flexShrink: 1 }, roomCardMeta: { color: colors.muted, fontSize: 12, flexShrink: 1 }, roomCardActions: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 4 },
  pageIntro: { gap: 4 }, sectionCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, gap: 14 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sectionCaption: { color: colors.muted, fontSize: 12, lineHeight: 18 }, filterPanel: { backgroundColor: colors.soft, borderRadius: 16, padding: 12, gap: 10 }, itemListCard: { paddingTop: 2 }, expiryItemsPanel: { gap: 12, marginTop: 6 }, itemFormStack: { gap: 16 }, itemFormSection: { gap: 8 }, itemFormSubsection: { gap: 8, marginTop: 4 }, itemFormField: { marginVertical: 0 }, itemFormFieldGroup: { gap: 8 }, categoryCapabilityRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginVertical: 8 }, settingsRow: { minHeight: 52, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 }, settingsRowLast: { borderBottomWidth: 0 }, settingsCopy: { flex: 1, minWidth: 0, gap: 6 }, settingsActions: { flexDirection: 'row', alignItems: 'center', gap: 2 }, categoryToggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }, categoryTag: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 }, categoryTagPrimary: { borderColor: colors.accent, backgroundColor: colors.soft }, subcategoryManageList: { gap: 4, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: LOCATION_TONES.submodule.border }, subcategoryManageRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.soft, color: colors.accent, fontSize: 12, fontWeight: '600' },
  mascot: { alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }, mascotEar: { position: 'absolute', top: 0, backgroundColor: colors.cat, borderWidth: 3, borderColor: colors.ink, borderRadius: 8, transform: [{ rotate: '45deg' }] }, mascotEarLeft: { left: '16%' }, mascotEarRight: { right: '16%' }, mascotHead: { backgroundColor: colors.cat, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', position: 'absolute', top: '10%' }, mascotEye: { width: 5, height: 16, borderRadius: 5, backgroundColor: colors.ink, position: 'absolute' }, mascotNose: { width: 7, height: 5, borderRadius: 5, backgroundColor: colors.ink, position: 'absolute' }, mascotBody: { backgroundColor: colors.cat, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, mascotBelly: { backgroundColor: colors.catWhite, marginTop: 16 },
});
