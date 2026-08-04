import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Empty, Field, ui } from '@/components/UI';
import {
  getScheduleColor,
  MonthCalendar,
} from '@/components/MonthCalendar';
import { colors } from '@/constants/theme';
import { formatDate, today, validDate } from '@/lib/date';
import { useApp } from '@/store/AppContext';
import { Schedule } from '@/types';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentUser,
    jobs,
    users,
    schedules,
    updateJob,
    setJobWorkers,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    canManageSchedule,
  } = useApp();
  const job = jobs.find((item) => item.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [assignOpen, setAssignOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [selectingEndDate, setSelectingEndDate] = useState(true);
  const [note, setNote] = useState('');
  const [editTitle, setEditTitle] = useState(job?.title ?? '');
  const [editLocation, setEditLocation] = useState(job?.location ?? '');
  const [editDescription, setEditDescription] = useState(
    job?.description ?? '',
  );
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(
    job?.workerIds ?? [],
  );
  const jobSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => schedule.jobId === id)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [schedules, id],
  );

  const canViewJob =
    !!job &&
    !!currentUser &&
    (currentUser.role === 'admin' ||
      job.createdBy === currentUser.id ||
      job.workerIds.includes(currentUser.id));
  const canManageJob =
    !!job &&
    !!currentUser &&
    (currentUser.role === 'admin' || job.createdBy === currentUser.id);

  if (!job || !currentUser || !canViewJob) {
    return (
      <View
        style={[
          ui.screen,
          { alignItems: 'center', justifyContent: 'center', gap: 14 },
        ]}
      >
        <Text>접근할 수 없는 작업입니다.</Text>
        <Button title="돌아가기" onPress={() => router.back()} />
      </View>
    );
  }

  const saveSchedule = async () => {
    if (!title.trim()) {
      Alert.alert('확인', '일정명을 입력해주세요.');
      return;
    }
    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      startDate > endDate
    ) {
      Alert.alert(
        '확인',
        '날짜를 YYYY-MM-DD 형식으로 올바르게 입력해주세요.',
      );
      return;
    }

    const scheduleInput = {
      jobId: job.id,
      title: title.trim(),
      startDate,
      endDate,
      note: note.trim(),
    };
    const error = editingScheduleId
      ? await updateSchedule(editingScheduleId, scheduleInput)
      : await addSchedule(scheduleInput);
    if (error) {
      Alert.alert(editingScheduleId ? '수정 실패' : '등록 실패', error);
      return;
    }

    setTitle('');
    setNote('');
    setEditingScheduleId(null);
    setScheduleOpen(false);
  };

  const openEditJob = () => {
    setEditTitle(job.title);
    setEditLocation(job.location);
    setEditDescription(job.description);
    setEditOpen(true);
  };

  const saveEditedJob = async () => {
    if (!editTitle.trim()) {
      Alert.alert('확인', '작업명을 입력해주세요.');
      return;
    }

    const error = await updateJob(job.id, {
      title: editTitle.trim(),
      location: editLocation.trim(),
      description: editDescription.trim(),
    });
    if (error) {
      Alert.alert('수정 실패', error);
      return;
    }
    setEditOpen(false);
  };

  const openForDate = (date: string) => {
    setEditingScheduleId(null);
    setTitle('');
    setNote('');
    setStartDate(date);
    setEndDate(date);
    setSelectingEndDate(true);
    setScheduleOpen(true);
  };

  const openForSchedule = (schedule: Schedule) => {
    if (!canManageSchedule(schedule)) {
      Alert.alert(
        '수정 권한 없음',
        '작업자는 자신이 등록한 일정만 수정할 수 있습니다.',
      );
      return;
    }

    setEditingScheduleId(schedule.id);
    setTitle(schedule.title);
    setStartDate(schedule.startDate);
    setEndDate(schedule.endDate);
    setNote(schedule.note);
    setSelectingEndDate(false);
    setScheduleOpen(true);
  };

  const selectScheduleDate = (date: string) => {
    if (!selectingEndDate) {
      setStartDate(date);
      setEndDate(date);
      setSelectingEndDate(true);
      return;
    }

    if (date < startDate) {
      setEndDate(startDate);
      setStartDate(date);
    } else {
      setEndDate(date);
    }
    setSelectingEndDate(false);
  };

  const saveAssignments = async () => {
    const error = await setJobWorkers(job.id, selectedWorkers);
    if (error) {
      Alert.alert('배정 실패', error);
      return;
    }
    setAssignOpen(false);
  };

  const confirmDeleteSchedule = (scheduleId: string) => {
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const error = await deleteSchedule(scheduleId);
          if (error) Alert.alert('삭제 실패', error);
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
        <Card style={styles.hero}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={ui.badge}>{job.workerIds.length}명</Text>
          </View>
          {job.location ? (
            <Text style={styles.meta}>⌖ {job.location}</Text>
          ) : null}
          {job.description ? (
            <Text style={styles.description}>{job.description}</Text>
          ) : null}
          <View style={styles.people}>
            <Text style={styles.peopleLabel}>배정 작업자</Text>
            <Text style={styles.peopleValue}>
              {job.workerIds
                .map((userId) => users.find((user) => user.id === userId)?.name)
                .filter(Boolean)
                .join(', ') || '없음'}
            </Text>
          </View>
          {canManageJob ? (
            <Button
              title="작업 정보 수정"
              kind="secondary"
              onPress={openEditJob}
            />
          ) : null}
          {currentUser.role === 'admin' ? (
            <Button
              title="작업자 배정"
              kind="secondary"
              onPress={() => {
                setSelectedWorkers(job.workerIds);
                setAssignOpen(true);
              }}
            />
          ) : null}
        </Card>

        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={ui.sectionTitle}>작업 달력</Text>
          <Pressable
            onPress={() => openForDate(today())}
            style={styles.add}
          >
            <Text style={styles.addText}>＋ 일정 등록</Text>
          </Pressable>
        </View>
        <MonthCalendar
          schedules={jobSchedules}
          onSelectDate={openForDate}
          onSelectSchedule={openForSchedule}
        />

        <Text style={ui.sectionTitle}>등록된 일정</Text>
        {jobSchedules.length ? (
          jobSchedules.map((item) => (
            <Card key={item.id} style={styles.schedule}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.scheduleTitle}>{item.title}</Text>
                <Text style={styles.date}>
                  {formatDate(item.startDate)} ~ {formatDate(item.endDate)}
                </Text>
                {item.note ? (
                  <Text style={styles.note}>{item.note}</Text>
                ) : null}
                <Text style={styles.owner}>
                  등록:{' '}
                  {users.find((user) => user.id === item.createdBy)?.name ??
                    '알 수 없음'}
                </Text>
              </View>
              {canManageSchedule(item) ? (
                <Pressable
                  onPress={() => confirmDeleteSchedule(item.id)}
                >
                  <Text style={styles.delete}>삭제</Text>
                </Pressable>
              ) : null}
            </Card>
          ))
        ) : (
          <Empty
            title="등록된 일정이 없습니다"
            detail="달력의 날짜를 누르거나 일정 등록 버튼을 눌러주세요."
          />
        )}
      </ScrollView>

      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditOpen(false)}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>작업 정보 수정</Text>
            <Pressable onPress={() => setEditOpen(false)}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <Card style={{ gap: 16 }}>
            <Field
              label="작업명 *"
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="작업명을 입력하세요"
            />
            <Field
              label="현장 위치"
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="주소 또는 장소"
            />
            <Field
              label="작업 설명"
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="작업 내용을 입력하세요"
              multiline
              style={{
                height: 100,
                paddingTop: 14,
                textAlignVertical: 'top',
              }}
            />
            <Button title="수정 내용 저장" onPress={saveEditedJob} />
          </Card>
        </ScrollView>
      </Modal>

      <Modal
        visible={scheduleOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setScheduleOpen(false)}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>
              {editingScheduleId ? '일정 수정' : '일정 등록'}
            </Text>
            <Pressable
              onPress={() => {
                setEditingScheduleId(null);
                setScheduleOpen(false);
              }}
            >
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <Card style={{ gap: 16 }}>
            <Field
              label="일정명 *"
              value={title}
              onChangeText={setTitle}
              placeholder="예: 전기 배선 작업"
            />
            <View style={styles.dateSelection}>
              <Text style={styles.dateSelectionLabel}>작업 기간</Text>
              <Text style={styles.dateSelectionValue}>
                {startDate} ~ {endDate}
              </Text>
              <Text style={styles.dateSelectionHint}>
                {selectingEndDate
                  ? '종료일을 선택해주세요.'
                  : '기간이 선택되었습니다. 다른 날짜를 누르면 다시 선택합니다.'}
              </Text>
            </View>
            <MonthCalendar
              schedules={[]}
              onSelectDate={selectScheduleDate}
              selectedStartDate={startDate}
              selectedEndDate={endDate}
              selectionColor={
                editingScheduleId
                  ? getScheduleColor(editingScheduleId)
                  : undefined
              }
            />
            <Field
              label="메모"
              value={note}
              onChangeText={setNote}
              placeholder="참고할 내용을 입력하세요"
              multiline
              style={{ height: 90, paddingTop: 14, textAlignVertical: 'top' }}
            />
            <Button
              title={editingScheduleId ? '수정 내용 저장' : '일정 등록'}
              onPress={saveSchedule}
            />
          </Card>
        </ScrollView>
      </Modal>

      <Modal
        visible={assignOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAssignOpen(false)}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>작업자 배정</Text>
            <Pressable onPress={() => setAssignOpen(false)}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <Text style={ui.subtitle}>
            {job.title}에 참여할 작업자를 선택하세요.
          </Text>
          {users
            .filter((user) => user.role === 'worker' && user.active)
            .map((worker) => {
              const selected = selectedWorkers.includes(worker.id);
              return (
                <Pressable
                  key={worker.id}
                  onPress={() =>
                    setSelectedWorkers(
                      selected
                        ? selectedWorkers.filter((id) => id !== worker.id)
                        : [...selectedWorkers, worker.id],
                    )
                  }
                >
                  <Card
                    style={[
                      styles.worker,
                      selected && styles.workerSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.check,
                        selected && styles.checkSelected,
                      ]}
                    >
                      <Text style={styles.checkText}>
                        {selected ? '✓' : ''}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.workerName}>{worker.name}</Text>
                      <Text style={styles.owner}>@{worker.loginId}</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          <Button title="선택한 작업자 배정" onPress={saveAssignments} />
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10 },
  jobTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  meta: { color: colors.muted },
  description: { color: '#475467', lineHeight: 21 },
  people: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  peopleLabel: { color: colors.muted, fontSize: 12 },
  peopleValue: { color: colors.ink, fontWeight: '600' },
  add: {
    backgroundColor: colors.primary,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addText: { color: '#fff', fontWeight: '700' },
  schedule: { flexDirection: 'row', gap: 10 },
  scheduleTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  date: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  dateSelection: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  dateSelectionLabel: { color: colors.muted, fontSize: 12 },
  dateSelectionValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  dateSelectionHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  note: { color: '#475467', lineHeight: 19 },
  owner: { color: colors.muted, fontSize: 12 },
  delete: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    padding: 5,
  },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  worker: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  check: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkText: { color: '#fff', fontWeight: '900' },
  workerName: { color: colors.ink, fontWeight: '700', fontSize: 16 },
});
