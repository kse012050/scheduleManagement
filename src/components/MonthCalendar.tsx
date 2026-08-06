import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { dateKey, isDateInRange, monthTitle, today } from '@/lib/date';
import {
  getKoreanHolidays,
  isKoreanNonWorkingDay,
} from '@/lib/koreanHolidays';
import { Schedule } from '@/types';

const scheduleColors = [
  '#2563EB',
  '#16A34A',
  '#EA580C',
  '#9333EA',
  '#DB2777',
  '#0891B2',
];

export const getScheduleColor = (id: string) => {
  const hash = [...id].reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return scheduleColors[hash % scheduleColors.length];
};

const moveDate = (value: string, amount: number) => {
  const [year, month, day] = value.split('-').map(Number);
  const moved = new Date(year, month - 1, day + amount);
  return dateKey(moved.getFullYear(), moved.getMonth(), moved.getDate());
};

const isScheduleActiveOnDate = (schedule: Schedule, value: string) =>
  isDateInRange(value, schedule.startDate, schedule.endDate) &&
  !(
    schedule.excludeNonWorkingDays &&
    isKoreanNonWorkingDay(value) &&
    !schedule.includedNonWorkingDates.includes(value)
  );

type MonthCalendarProps = {
  schedules: Schedule[];
  onSelectDate?: (date: string) => void;
  onSelectSchedule?: (schedule: Schedule) => void;
  selectedStartDate?: string;
  selectedEndDate?: string;
  selectionColor?: string;
  excludeNonWorkingDays?: boolean;
  includedNonWorkingDates?: string[];
  enableNonWorkingDateExceptions?: boolean;
};

export function MonthCalendar({
  schedules,
  onSelectDate,
  onSelectSchedule,
  selectedStartDate,
  selectedEndDate,
  selectionColor = colors.primary,
  excludeNonWorkingDays = false,
  includedNonWorkingDates = [],
  enableNonWorkingDateExceptions = false,
}: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const initialDate = selectedStartDate
      ? new Date(`${selectedStartDate}T00:00:00`)
      : new Date();
    return Number.isNaN(initialDate.getTime()) ? new Date() : initialDate;
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const monthStart = dateKey(year, month, 1);
  const monthEnd = dateKey(year, month, days);
  const koreanHolidays = useMemo(() => getKoreanHolidays(year), [year]);
  const cells = [
    ...Array(leading).fill(null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const scheduleLanes = useMemo(() => {
    const lanes = new Map<string, Schedule[]>();

    [...schedules]
      .filter(
        (schedule) =>
          schedule.endDate >= monthStart &&
          schedule.startDate <= monthEnd,
      )
      .sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) ||
          a.endDate.localeCompare(b.endDate) ||
          a.id.localeCompare(b.id),
      )
      .forEach((schedule) => {
        const laneKey = schedule.workerId
          ? `worker:${schedule.workerId}`
          : `schedule:${schedule.id}`;
        const lane = lanes.get(laneKey) ?? [];
        lane.push(schedule);
        lanes.set(laneKey, lane);
      });

    return [...lanes.entries()].map(([key, laneSchedules]) => ({
      key,
      schedules: laneSchedules,
    }));
  }, [schedules, monthStart, monthEnd]);
  const visibleScheduleLanes = scheduleLanes.slice(0, 3);

  const move = (amount: number) =>
    setCursor(new Date(year, month + amount, 1));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => move(-1)} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{monthTitle(cursor)}</Text>
        <Pressable onPress={() => move(1)} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.week}>
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <Text
            key={day}
            style={[
              styles.weekText,
              index === 0 && { color: colors.danger },
              index === 6 && { color: '#2563EB' },
            ]}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }

          const key = dateKey(year, month, day);
          const holiday = koreanHolidays.get(key);
          const nonWorkingDay = isKoreanNonWorkingDay(key);
          const includedNonWorkingDay =
            includedNonWorkingDates.includes(key);
          const canToggleNonWorkingDay =
            excludeNonWorkingDays &&
            nonWorkingDay &&
            enableNonWorkingDateExceptions &&
            !!selectedStartDate &&
            !!selectedEndDate &&
            isDateInRange(key, selectedStartDate, selectedEndDate);
          const dateDisabled =
            excludeNonWorkingDays &&
            nonWorkingDay &&
            !canToggleNonWorkingDay;
          const selectableDate = !(
            excludeNonWorkingDays &&
            nonWorkingDay &&
            !includedNonWorkingDay
          );
          const selected =
            !!selectedStartDate &&
            !!selectedEndDate &&
            isDateInRange(key, selectedStartDate, selectedEndDate) &&
            selectableDate;
          const isSelectionStart =
            selectableDate && key === selectedStartDate;
          const isSelectionEnd = selectableDate && key === selectedEndDate;
          const weekStart = index % 7 === 0;
          const weekEnd = index % 7 === 6;

          return (
            <Pressable
              key={key}
              disabled={dateDisabled}
              onPress={() => onSelectDate?.(key)}
              style={[
                styles.cell,
                dateDisabled && styles.disabledCell,
                selected && {
                  backgroundColor: `${selectionColor}1F`,
                },
              ]}
            >
              <View style={styles.daySlot}>
                <Text
                  style={[
                    styles.day,
                    weekEnd && { color: '#2563EB' },
                    (weekStart || holiday) && { color: colors.danger },
                    key === today() &&
                      !isSelectionStart &&
                      !isSelectionEnd &&
                      styles.todayDay,
                    (isSelectionStart || isSelectionEnd) &&
                      [
                        styles.selectedDay,
                        { backgroundColor: selectionColor },
                      ],
                  ]}
                >
                  {day}
                </Text>
              </View>

              <View style={styles.holidaySlot}>
                {holiday ? (
                  <Text numberOfLines={1} style={styles.holidayName}>
                    {holiday.substitute ? '대체공휴일' : holiday.name}
                  </Text>
                ) : null}
              </View>

              <View style={styles.lanes}>
                {visibleScheduleLanes.map((lane) => {
                  const schedule = lane.schedules.find((item) =>
                    isScheduleActiveOnDate(item, key),
                  );
                  if (!schedule) {
                    return (
                      <View
                        key={`${lane.key}-empty`}
                        style={styles.emptyBar}
                      />
                    );
                  }

                  const continuesFromPreviousMonth =
                    day === 1 && schedule.startDate < monthStart;
                  const continuesToNextMonth =
                    day === days && schedule.endDate > monthEnd;
                  const startsHere =
                    key === schedule.startDate ||
                    weekStart ||
                    continuesFromPreviousMonth ||
                    !isScheduleActiveOnDate(schedule, moveDate(key, -1));
                  const endsHere =
                    key === schedule.endDate ||
                    weekEnd ||
                    continuesToNextMonth ||
                    !isScheduleActiveOnDate(schedule, moveDate(key, 1));
                  return (
                    <Pressable
                      key={`${lane.key}-${schedule.id}`}
                      disabled={!onSelectSchedule}
                      onPress={(event) => {
                        event.stopPropagation();
                        onSelectSchedule?.(schedule);
                      }}
                      style={[
                        styles.bar,
                        {
                          backgroundColor: getScheduleColor(
                            schedule.workerId ?? schedule.id,
                          ),
                          marginLeft: startsHere ? 3 : 0,
                          marginRight: endsHere ? 3 : 0,
                          borderTopLeftRadius: startsHere ? 4 : 0,
                          borderBottomLeftRadius: startsHere ? 4 : 0,
                          borderTopRightRadius: endsHere ? 4 : 0,
                          borderBottomRightRadius: endsHere ? 4 : 0,
                        },
                      ]}
                    >
                      {startsHere ? (
                        <Text numberOfLines={1} style={styles.barText}>
                          {continuesFromPreviousMonth
                            ? `← ${schedule.title}`
                            : schedule.title}
                        </Text>
                      ) : null}
                      {continuesToNextMonth ? (
                        <Text style={styles.continueArrow}>→</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </View>

      {visibleScheduleLanes.length === 3 && scheduleLanes.length > 3 ? (
        <Text style={styles.more}>
          작업자 일정 중 3개 라인까지 달력에 표시됩니다.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: colors.ink, fontSize: 25, lineHeight: 27 },
  month: { fontSize: 17, fontWeight: '800', color: colors.ink },
  week: { flexDirection: 'row' },
  weekText: {
    width: '14.285%',
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.285%',
    height: 82,
    alignItems: 'center',
    paddingTop: 6,
  },
  disabledCell: { opacity: 0.45 },
  daySlot: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  day: { fontSize: 13, lineHeight: 18, color: colors.ink },
  todayDay: {
    backgroundColor: '#FFEDD5',
    color: '#C2410C',
    borderWidth: 1,
    borderColor: '#FB923C',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 5,
  },
  selectedDay: {
    color: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 5,
  },
  holidaySlot: {
    width: '100%',
    height: 11,
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  holidayName: {
    width: '100%',
    color: colors.danger,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
    textAlign: 'center',
  },
  lanes: { width: '100%', gap: 2 },
  bar: {
    height: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  emptyBar: { height: 13 },
  barText: {
    flex: 1,
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  continueArrow: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  more: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
