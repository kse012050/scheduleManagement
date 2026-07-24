import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { dateKey, isDateInRange, monthTitle, today } from '@/lib/date';
import { Schedule } from '@/types';

export function MonthCalendar({ schedules, onSelectDate }: { schedules: Schedule[]; onSelectDate: (date: string) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(leading).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const move = (amount: number) => setCursor(new Date(year, month + amount, 1));
  return <View style={styles.wrap}>
    <View style={styles.header}><Pressable onPress={() => move(-1)} style={styles.arrow}><Text>‹</Text></Pressable><Text style={styles.month}>{monthTitle(cursor)}</Text><Pressable onPress={() => move(1)} style={styles.arrow}><Text>›</Text></Pressable></View>
    <View style={styles.week}>{['일','월','화','수','목','금','토'].map((d, i) => <Text key={d} style={[styles.weekText, i === 0 && { color: colors.danger }]}>{d}</Text>)}</View>
    <View style={styles.grid}>{cells.map((day, index) => {
      if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
      const key = dateKey(year, month, day); const items = schedules.filter((s) => isDateInRange(key, s.startDate, s.endDate));
      return <Pressable key={key} onPress={() => onSelectDate(key)} style={[styles.cell, key === today() && styles.today]}><Text style={[styles.day, index % 7 === 0 && { color: colors.danger }]}>{day}</Text><View style={styles.dots}>{items.slice(0, 3).map((s) => <View key={s.id} style={styles.dot} />)}</View></Pressable>;
    })}</View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  arrow: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }, month: { fontSize: 17, fontWeight: '800', color: colors.ink },
  week: { flexDirection: 'row' }, weekText: { width: '14.285%', textAlign: 'center', paddingVertical: 8, fontSize: 12, color: colors.muted, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285%', height: 48, alignItems: 'center', paddingTop: 7, borderRadius: 10 }, today: { backgroundColor: colors.primarySoft }, day: { fontSize: 13, color: colors.ink }, dots: { flexDirection: 'row', gap: 2, marginTop: 5 }, dot: { width: 4, height: 4, borderRadius: 3, backgroundColor: colors.primary },
});
