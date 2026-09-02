import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getScheduleColor, MonthCalendar } from '@/components/MonthCalendar';
import { Card, Empty, ui } from '@/components/UI';
import { colors } from '@/constants/theme';
import { formatDate, today } from '@/lib/date';
import { useApp } from '@/store/AppContext';

export default function Home() {
  const { currentUser, jobs, schedules, users, workTypes } = useApp();

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const visibleJobs = isAdmin
    ? jobs
    : jobs.filter((job) => job.workerIds.includes(currentUser.id));
  const visibleJobIds = new Set(visibleJobs.map((job) => job.id));
  const personalSchedules = isAdmin
    ? []
    : schedules.filter(
        (schedule) =>
          schedule.workerId === currentUser.id &&
          visibleJobIds.has(schedule.jobId),
      );
  const visibleSchedules = isAdmin ? schedules : personalSchedules;
  const futureSchedules = visibleSchedules
    .filter(
      (schedule) =>
        visibleJobIds.has(schedule.jobId) && schedule.endDate >= today(),
    )
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.endDate.localeCompare(b.endDate),
    );
  const upcoming = futureSchedules.slice(0, 3);
  const personalCalendarSchedules = personalSchedules.map((schedule) => ({
    ...schedule,
    title:
      jobs.find((job) => job.id === schedule.jobId)?.title ?? schedule.title,
  }));
  const workerColor = workTypes.find(
    (workType) => workType.id === currentUser.workTypeId,
  )?.colorHex;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <View>
        <Text style={styles.hello}>{currentUser.name}님, 안녕하세요 👋</Text>
        <Text style={ui.subtitle}>
          {isAdmin
            ? '오늘의 작업 현황을 확인하세요.'
            : '배정된 작업과 개인 일정을 확인하세요.'}
        </Text>
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statNumber}>{visibleJobs.length}</Text>
          <Text style={styles.statLabel}>
            {isAdmin ? '전체 작업' : '배정 작업'}
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statNumber}>
            {isAdmin
              ? users.filter((user) => user.role === 'worker').length
              : futureSchedules.length}
          </Text>
          <Text style={styles.statLabel}>
            {isAdmin ? '작업자' : '예정 일정'}
          </Text>
        </Card>
      </View>

      {!isAdmin ? (
        <>
          <Text style={ui.sectionTitle}>내 작업 달력</Text>
          <MonthCalendar
            schedules={personalCalendarSchedules}
            scheduleColor={(schedule) =>
              workerColor ?? getScheduleColor(schedule.jobId)
            }
          />
        </>
      ) : null}

      <Text style={ui.sectionTitle}>다가오는 일정</Text>
      {upcoming.length ? (
        upcoming.map((item) => {
          const job = jobs.find((candidate) => candidate.id === item.jobId);
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/job/${item.jobId}`)}
            >
              <Card style={styles.schedule}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateMonth}>
                    {item.startDate.slice(5, 7)}월
                  </Text>
                  <Text style={styles.dateDay}>
                    {item.startDate.slice(8, 10)}
                  </Text>
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTitle}>{item.title}</Text>
                  <Text style={styles.meta}>{job?.title}</Text>
                  <Text style={styles.meta}>
                    {formatDate(item.startDate)} ~ {formatDate(item.endDate)}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Card>
            </Pressable>
          );
        })
      ) : (
        <Empty
          title="예정된 일정이 없습니다"
          detail={
            isAdmin
              ? '작업 상세에서 새 일정을 등록해보세요.'
              : '관리자가 일정을 배정하면 개인 달력에 표시됩니다.'
          }
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hello: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 6,
  },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 },
  statNumber: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLabel: { color: colors.muted, marginTop: 3 },
  schedule: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scheduleInfo: { flex: 1 },
  dateBox: {
    width: 52,
    height: 58,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateMonth: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  dateDay: { fontSize: 20, color: colors.primaryDark, fontWeight: '800' },
  scheduleTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chevron: { color: '#98A2B3', fontSize: 26 },
});
