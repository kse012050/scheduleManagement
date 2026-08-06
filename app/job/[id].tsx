import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  hasKoreanWorkingDay,
  isKoreanNonWorkingDay,
  nextKoreanWorkingDay,
} from '@/lib/koreanHolidays';
import { useApp } from '@/store/AppContext';
import { Schedule } from '@/types';

const formatPhone = (value: string) => {
  if (value.length === 11) {
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }
  if (value.length === 10) {
    return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
  }
  return value;
};

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    ready,
    currentUser,
    jobs,
    users,
    workTypes,
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
  const [scheduleError, setScheduleError] = useState('');
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState('');
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignmentWorkerOrder, setAssignmentWorkerOrder] = useState<
    string[]
  >([]);
  const [selectedScheduleWorkerId, setSelectedScheduleWorkerId] = useState<
    string | null
  >(null);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [selectingEndDate, setSelectingEndDate] = useState(true);
  const [excludeNonWorkingDays, setExcludeNonWorkingDays] = useState(true);
  const [includedNonWorkingDates, setIncludedNonWorkingDates] = useState<
    string[]
  >([]);
  const [note, setNote] = useState('');
  const [editTitle, setEditTitle] = useState(job?.title ?? '');
  const [editLocation, setEditLocation] = useState(job?.location ?? '');
  const [editDescription, setEditDescription] = useState(
    job?.description ?? '',
  );
  const [editCustomerPhone, setEditCustomerPhone] = useState(
    job?.customerPhone ?? '',
  );
  const [editEntryPassword, setEditEntryPassword] = useState(
    job?.entryPassword ?? '',
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
  const canManageJob = !!job && currentUser?.role === 'admin';

  if (!ready) {
    return (
      <View
        style={[
          ui.screen,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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

  const selectableScheduleWorkers = job.workerIds
    .map((workerId) => users.find((user) => user.id === workerId))
    .filter(
      (worker): worker is NonNullable<typeof worker> =>
        !!worker &&
        worker.role === 'worker' &&
        worker.active &&
        (currentUser.role === 'admin' || worker.id === currentUser.id),
    );

  const saveSchedule = async () => {
    setScheduleError('');
    if (
      !selectedScheduleWorkerId ||
      !selectableScheduleWorkers.some(
        (worker) => worker.id === selectedScheduleWorkerId,
      )
    ) {
      const message = '등록할 작업자를 선택해주세요.';
      setScheduleError(message);
      Alert.alert('확인', message);
      return;
    }
    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      startDate > endDate
    ) {
      const message =
        '날짜를 YYYY-MM-DD 형식으로 올바르게 입력해주세요.';
      setScheduleError(message);
      Alert.alert('확인', message);
      return;
    }
    if (
      excludeNonWorkingDays &&
      !hasKoreanWorkingDay(startDate, endDate) &&
      includedNonWorkingDates.length === 0
    ) {
      const message =
        '선택한 기간에 등록 가능한 평일이 없습니다. 기간을 변경하거나 주말·공휴일 제외를 해제해주세요.';
      setScheduleError(message);
      Alert.alert('확인', message);
      return;
    }

    const overlappingSchedule = schedules.find(
      (schedule) =>
        schedule.workerId === selectedScheduleWorkerId &&
        schedule.id !== editingScheduleId &&
        schedule.startDate <= endDate &&
        schedule.endDate >= startDate,
    );
    if (overlappingSchedule) {
      const selectedWorker = selectableScheduleWorkers.find(
        (worker) => worker.id === selectedScheduleWorkerId,
      );
      const message = `${selectedWorker?.name ?? '선택한 작업자'}에게 ${formatDate(
        overlappingSchedule.startDate,
      )} ~ ${formatDate(
        overlappingSchedule.endDate,
      )} 일정이 이미 등록되어 있습니다.`;
      setScheduleError(message);
      Alert.alert('일정 중복', message);
      return;
    }

    const scheduleInput = {
      jobId: job.id,
      workerId: selectedScheduleWorkerId,
      startDate,
      endDate,
      excludeNonWorkingDays,
      includedNonWorkingDates,
      note: note.trim(),
    };
    const error = editingScheduleId
      ? await updateSchedule(editingScheduleId, scheduleInput)
      : await addSchedule(scheduleInput);
    if (error) {
      setScheduleError(error);
      Alert.alert(editingScheduleId ? '수정 실패' : '등록 실패', error);
      return;
    }

    setSelectedScheduleWorkerId(null);
    setExcludeNonWorkingDays(true);
    setIncludedNonWorkingDates([]);
    setNote('');
    setEditingScheduleId(null);
    setScheduleError('');
    setScheduleOpen(false);
  };

  const openEditJob = () => {
    setEditTitle(job.title);
    setEditLocation(job.location);
    setEditDescription(job.description);
    setEditCustomerPhone(job.customerPhone);
    setEditEntryPassword(job.entryPassword);
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
      customerPhone: editCustomerPhone,
      entryPassword: editEntryPassword,
    });
    if (error) {
      Alert.alert('수정 실패', error);
      return;
    }
    setEditOpen(false);
  };

  const openForDate = (date: string) => {
    const initialDate = isKoreanNonWorkingDay(date)
      ? nextKoreanWorkingDay(date)
      : date;
    setEditingScheduleId(null);
    setScheduleError('');
    setSelectedScheduleWorkerId(null);
    setNote('');
    setStartDate(initialDate);
    setEndDate(initialDate);
    setSelectingEndDate(true);
    setExcludeNonWorkingDays(true);
    setIncludedNonWorkingDates([]);
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
    setScheduleError('');
    setSelectedScheduleWorkerId(schedule.workerId);
    setStartDate(schedule.startDate);
    setEndDate(schedule.endDate);
    setExcludeNonWorkingDays(schedule.excludeNonWorkingDays);
    setIncludedNonWorkingDates(schedule.includedNonWorkingDates);
    setNote(schedule.note);
    setSelectingEndDate(false);
    setScheduleOpen(true);
  };

  const selectScheduleDate = (date: string) => {
    setScheduleError('');
    if (excludeNonWorkingDays && isKoreanNonWorkingDay(date)) {
      if (
        !selectingEndDate &&
        date >= startDate &&
        date <= endDate
      ) {
        setIncludedNonWorkingDates((previous) =>
          previous.includes(date)
            ? previous.filter((item) => item !== date)
            : [...previous, date].sort(),
        );
      }
      return;
    }

    if (!selectingEndDate) {
      setStartDate(date);
      setEndDate(date);
      setSelectingEndDate(true);
      setIncludedNonWorkingDates([]);
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

  const openAssignments = () => {
    const initiallySelected = new Set(job.workerIds);
    const orderedWorkerIds = users
      .filter((user) => user.role === 'worker' && user.active)
      .sort(
        (a, b) =>
          Number(initiallySelected.has(a.id)) -
          Number(initiallySelected.has(b.id)),
      )
      .map((worker) => worker.id);

    setSelectedWorkers(job.workerIds);
    setAssignmentWorkerOrder(orderedWorkerIds);
    setAssignOpen(true);
  };

  const confirmDeleteSchedule = (scheduleId: string) => {
    setDeleteError('');
    setDeleteScheduleId(scheduleId);
  };

  const removeSchedule = async () => {
    if (!deleteScheduleId || deletingSchedule) return;

    setDeleteError('');
    setDeletingSchedule(true);
    const error = await deleteSchedule(deleteScheduleId);
    setDeletingSchedule(false);

    if (error) {
      setDeleteError(error);
      return;
    }

    if (editingScheduleId === deleteScheduleId) {
      setEditingScheduleId(null);
      setSelectedScheduleWorkerId(null);
      setScheduleError('');
      setScheduleOpen(false);
    }
    setDeleteScheduleId(null);
  };

  return (
    <>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
        <Card style={styles.hero}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={ui.badge}>{job.workerIds.length}명</Text>
          </View>
          {job.description ? (
            <Text style={styles.description}>{job.description}</Text>
          ) : null}
          {job.location ||
          job.customerPhone ||
          job.entryPassword ||
          canManageJob ? (
            <View style={styles.accessInfo}>
              <View style={styles.accessHeader}>
                <Text style={styles.accessTitle}>현장 정보</Text>
                {canManageJob ? (
                  <Pressable
                    onPress={openEditJob}
                    style={styles.compactEditButton}
                  >
                    <Text style={styles.compactEditButtonText}>정보 수정</Text>
                  </Pressable>
                ) : null}
              </View>
              {job.location ? (
                <View style={styles.accessRow}>
                  <Text style={styles.accessLabel}>위치</Text>
                  <Text style={styles.accessValue}>⌖ {job.location}</Text>
                </View>
              ) : null}
              {job.customerPhone ? (
                <View style={styles.accessRow}>
                  <Text style={styles.accessLabel}>고객 전화번호</Text>
                  <Text selectable style={styles.accessValue}>
                    {formatPhone(job.customerPhone)}
                  </Text>
                </View>
              ) : null}
              {job.entryPassword ? (
                <View style={styles.accessRow}>
                  <Text style={styles.accessLabel}>현장 출입 비밀번호</Text>
                  <Text selectable style={styles.accessValue}>
                    {job.entryPassword}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.people}>
            <Text style={styles.peopleLabel}>배정 작업자</Text>
            {job.workerIds.length ? (
              <View style={styles.assignedWorkerList}>
                {job.workerIds.map((userId) => {
                  const worker = users.find((user) => user.id === userId);
                  if (!worker) return null;
                  const workType = workTypes.find(
                    (item) => item.id === worker.workTypeId,
                  );
                  const workTypeColor = workType?.colorHex ?? colors.muted;

                  return (
                    <View
                      key={worker.id}
                      style={styles.assignedWorker}
                    >
                      <Text
                        style={[
                          styles.assignedWorkTypeText,
                          { color: workTypeColor },
                        ]}
                      >
                        {workType?.name ?? '미지정'}
                      </Text>
                      <Text style={styles.assignedWorkerName}>
                        {worker.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.peopleValue}>없음</Text>
            )}
          </View>
          {currentUser.role === 'admin' ? (
            <Button
              title="작업자 배정"
              kind="secondary"
              onPress={openAssignments}
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
                {item.excludeNonWorkingDays ? (
                  <Text style={styles.excludedDaysLabel}>
                    토·일·공휴일 제외
                    {item.includedNonWorkingDates.length
                      ? ` · 예외 ${item.includedNonWorkingDates.length}일`
                      : ''}
                  </Text>
                ) : null}
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
              label="고객 전화번호"
              value={editCustomerPhone}
              onChangeText={(value) =>
                setEditCustomerPhone(
                  value.replace(/[^0-9]/g, '').slice(0, 11),
                )
              }
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="숫자만 입력"
            />
            <Field
              label="현장 출입 비밀번호"
              value={editEntryPassword}
              onChangeText={setEditEntryPassword}
              maxLength={50}
              placeholder="현관 또는 공동현관 비밀번호"
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
        onRequestClose={() => {
          setEditingScheduleId(null);
          setSelectedScheduleWorkerId(null);
          setScheduleError('');
          setExcludeNonWorkingDays(true);
          setIncludedNonWorkingDates([]);
          setScheduleOpen(false);
        }}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>
              {editingScheduleId ? '일정 수정' : '일정 등록'}
            </Text>
            <Pressable
              onPress={() => {
                setEditingScheduleId(null);
                setSelectedScheduleWorkerId(null);
                setScheduleError('');
                setExcludeNonWorkingDays(true);
                setIncludedNonWorkingDates([]);
                setScheduleOpen(false);
              }}
            >
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <Card style={{ gap: 16 }}>
            <View style={styles.scheduleWorkerSelection}>
              <Text style={styles.scheduleWorkerLabel}>등록 작업자 *</Text>
              {selectableScheduleWorkers.length ? (
                <View style={styles.scheduleWorkerOptions}>
                  {selectableScheduleWorkers.map((worker) => {
                    const selected = selectedScheduleWorkerId === worker.id;
                    const workType = workTypes.find(
                      (item) => item.id === worker.workTypeId,
                    );

                    return (
                      <Pressable
                        key={worker.id}
                        onPress={() => {
                          setSelectedScheduleWorkerId(worker.id);
                          setScheduleError('');
                        }}
                        style={[
                          styles.scheduleWorkerOption,
                          selected && styles.scheduleWorkerOptionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.scheduleWorkerWorkType,
                            { color: workType?.colorHex ?? colors.muted },
                          ]}
                        >
                          {workType?.name ?? '미지정'}
                        </Text>
                        <Text style={styles.scheduleWorkerName}>
                          {worker.name}
                        </Text>
                        {selected ? (
                          <Text style={styles.scheduleWorkerCheck}>✓</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.scheduleWorkerEmpty}>
                  선택할 수 있는 배정 작업자가 없습니다.
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => {
                setExcludeNonWorkingDays((value) => {
                  const nextValue = !value;
                  if (!nextValue) setIncludedNonWorkingDates([]);
                  return nextValue;
                });
              }}
              style={styles.excludeDaysOption}
            >
              <View
                style={[
                  styles.excludeDaysCheck,
                  excludeNonWorkingDays && styles.excludeDaysCheckSelected,
                ]}
              >
                <Text style={styles.excludeDaysCheckText}>
                  {excludeNonWorkingDays ? '✓' : ''}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.excludeDaysTitle}>
                  주말·공휴일 제외
                </Text>
                <Text style={styles.excludeDaysHint}>
                  토요일, 일요일, 공휴일과 대체공휴일을 일정에서 뺍니다.
                </Text>
              </View>
            </Pressable>
            <View style={styles.dateSelection}>
              <Text style={styles.dateSelectionLabel}>작업 기간</Text>
              <Text style={styles.dateSelectionValue}>
                {startDate} ~ {endDate}
              </Text>
              <Text style={styles.dateSelectionHint}>
                {selectingEndDate
                  ? excludeNonWorkingDays
                    ? '종료일을 선택해주세요. 주말과 공휴일은 선택할 수 없습니다.'
                    : '종료일을 선택해주세요.'
                  : excludeNonWorkingDays
                    ? '기간 안의 주말·공휴일을 누르면 예외 작업일로 추가할 수 있습니다.'
                    : '기간이 선택되었습니다. 다른 날짜를 누르면 다시 선택합니다.'}
              </Text>
            </View>
            <MonthCalendar
              schedules={[]}
              onSelectDate={selectScheduleDate}
              selectedStartDate={startDate}
              selectedEndDate={endDate}
              excludeNonWorkingDays={excludeNonWorkingDays}
              includedNonWorkingDates={includedNonWorkingDates}
              enableNonWorkingDateExceptions={!selectingEndDate}
              selectionColor={
                selectedScheduleWorkerId
                  ? getScheduleColor(selectedScheduleWorkerId)
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
            {scheduleError ? (
              <View style={styles.scheduleError}>
                <Text style={styles.scheduleErrorTitle}>등록할 수 없습니다</Text>
                <Text style={styles.scheduleErrorText}>{scheduleError}</Text>
              </View>
            ) : null}
            <Button
              title={editingScheduleId ? '수정 내용 저장' : '일정 등록'}
              onPress={saveSchedule}
            />
            {editingScheduleId ? (
              <Button
                title="이 일정 삭제"
                kind="danger"
                onPress={() => confirmDeleteSchedule(editingScheduleId)}
              />
            ) : null}
          </Card>
        </ScrollView>
      </Modal>

      <Modal
        visible={!!deleteScheduleId}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingSchedule) setDeleteScheduleId(null);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <Card style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>일정을 삭제할까요?</Text>
            <Text style={styles.confirmText}>
              {jobSchedules.find((item) => item.id === deleteScheduleId)
                ?.title ?? '선택한 일정'}
              을 삭제하면 달력과 목록에서 제거되며 복구할 수 없습니다.
            </Text>
            {deleteError ? (
              <Text style={styles.confirmError}>{deleteError}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <View style={styles.confirmAction}>
                <Button
                  title="취소"
                  kind="secondary"
                  disabled={deletingSchedule}
                  onPress={() => setDeleteScheduleId(null)}
                />
              </View>
              <View style={styles.confirmAction}>
                <Button
                  title={deletingSchedule ? '삭제 중...' : '삭제'}
                  kind="danger"
                  disabled={deletingSchedule}
                  onPress={removeSchedule}
                />
              </View>
            </View>
          </Card>
        </View>
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
            .sort(
              (a, b) => {
                const aIndex = assignmentWorkerOrder.indexOf(a.id);
                const bIndex = assignmentWorkerOrder.indexOf(b.id);
                return (
                  (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
                  (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
                );
              },
            )
            .map((worker) => {
              const selected = selectedWorkers.includes(worker.id);
              const workType = workTypes.find(
                (item) => item.id === worker.workTypeId,
              );
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
                    <View style={styles.workerInfo}>
                      <Text
                        style={[
                          styles.workerWorkTypeName,
                          { color: workType?.colorHex ?? colors.muted },
                        ]}
                      >
                        {workType?.name ?? '미지정'}
                      </Text>
                      <Text style={styles.workerName}>{worker.name}</Text>
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
  description: { color: '#475467', lineHeight: 21 },
  accessInfo: {
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accessTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  compactEditButton: {
    borderWidth: 1,
    borderColor: '#F3D79B',
    borderRadius: 9,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compactEditButtonText: {
    color: '#B54708',
    fontSize: 12,
    fontWeight: '800',
  },
  accessRow: { gap: 4 },
  accessLabel: { color: colors.muted, fontSize: 12 },
  accessValue: { color: colors.ink, fontWeight: '700' },
  people: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  peopleLabel: { color: colors.muted, fontSize: 12 },
  peopleValue: { color: colors.ink, fontWeight: '600' },
  assignedWorkerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  assignedWorker: {
    minHeight: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  assignedWorkerName: { color: colors.ink, fontWeight: '700' },
  assignedWorkTypeText: { fontSize: 13, fontWeight: '800' },
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
  excludedDaysLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
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
  scheduleWorkerSelection: { gap: 8 },
  scheduleWorkerLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  scheduleWorkerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleWorkerOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  scheduleWorkerOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  scheduleWorkerWorkType: { fontSize: 14, fontWeight: '900' },
  scheduleWorkerName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  scheduleWorkerCheck: { color: colors.primary, fontWeight: '900' },
  scheduleWorkerEmpty: { color: colors.danger, fontSize: 13 },
  excludeDaysOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
  },
  excludeDaysCheck: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  excludeDaysCheckSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  excludeDaysCheckText: { color: '#fff', fontWeight: '900' },
  excludeDaysTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  excludeDaysHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  scheduleError: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 4,
  },
  scheduleErrorTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  scheduleErrorText: { color: '#991B1B', fontSize: 13, lineHeight: 18 },
  confirmBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
  },
  confirmCard: { width: '100%', maxWidth: 420, gap: 14 },
  confirmTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  confirmText: { color: '#475467', fontSize: 14, lineHeight: 21 },
  confirmError: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmAction: { flex: 1 },
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
  workerInfo: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  workerWorkTypeName: { fontSize: 16, fontWeight: '900' },
  workerName: { color: colors.ink, fontWeight: '700', fontSize: 16 },
});
