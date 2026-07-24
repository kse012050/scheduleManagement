import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps } from 'react-native';
import { colors } from '@/constants/theme';

export function Card(props: ViewProps) { return <View {...props} style={[styles.card, props.style]} />; }

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor="#9CA3AF" {...props} style={[styles.input, props.style]} /></View>;
}

export function Button({ title, onPress, kind = 'primary', disabled = false }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, kind === 'secondary' && styles.secondaryButton, kind === 'danger' && styles.dangerButton, (pressed || disabled) && { opacity: .6 }]}>
    <Text style={[styles.buttonText, kind === 'secondary' && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>⌁</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  badge: { backgroundColor: colors.primarySoft, color: colors.primary, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  field: { gap: 7 }, label: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  input: { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#fff', color: colors.ink },
  button: { minHeight: 50, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: colors.primarySoft }, dangerButton: { backgroundColor: colors.danger },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, secondaryText: { color: colors.primary },
  empty: { paddingVertical: 50, alignItems: 'center', gap: 7 }, emptyIcon: { fontSize: 36, color: '#98A2B3' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink }, emptyDetail: { color: colors.muted, textAlign: 'center' },
});
