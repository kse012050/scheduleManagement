import { Redirect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, Empty, Field, ui } from '@/components/UI';
import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppContext';

type CreatedAccount = {
  loginId: string;
  name: string;
  phone?: string;
  workTypeName?: string;
  temporaryPassword: string;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
};

const normalizeContactPhone = (value: string) => {
  let digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('0082')) {
    digits = `0${digits.slice(4)}`;
  } else if (digits.startsWith('82')) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
};

type ContactSelection = {
  name: string;
  phones: string[];
  target: 'create' | 'edit';
};

type WorkerSort = 'name' | 'workType' | 'recent';

const workerSortOptions: { value: WorkerSort; label: string }[] = [
  { value: 'name', label: '이름순' },
  { value: 'workType', label: '작업 종류순' },
  { value: 'recent', label: '최근 등록순' },
];

export default function Workers() {
  const {
    currentUser,
    users,
    workTypes,
    jobs,
    addWorker,
    updateWorker,
    deleteWorker,
    resetWorkerPassword,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<number | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [pickingContact, setPickingContact] = useState(false);
  const [contactSelection, setContactSelection] =
    useState<ContactSelection | null>(null);
  const [busyWorkerId, setBusyWorkerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdAccount, setCreatedAccount] =
    useState<CreatedAccount | null>(null);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWorkTypeId, setEditWorkTypeId] = useState<number | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWorkTypeId, setFilterWorkTypeId] = useState<number | null>(null);
  const [workerSort, setWorkerSort] = useState<WorkerSort>('name');
  const [listOption, setListOption] = useState<'workType' | 'sort'>(
    'workType',
  );
  const [listOptionOpen, setListOptionOpen] = useState(false);

  if (!currentUser || currentUser.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  const workers = users.filter((user) => user.role === 'worker');
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleWorkers = workers
    .filter((worker) => {
      if (filterWorkTypeId && worker.workTypeId !== filterWorkTypeId) {
        return false;
      }

      if (!normalizedSearch) return true;
      const phoneDigits = worker.phone?.replace(/[^0-9]/g, '') ?? '';
      const searchDigits = normalizedSearch.replace(/[^0-9]/g, '');
      return (
        worker.name.toLowerCase().includes(normalizedSearch) ||
        worker.loginId.toLowerCase().includes(normalizedSearch) ||
        Boolean(searchDigits && phoneDigits.includes(searchDigits))
      );
    })
    .sort((left, right) => {
      if (workerSort === 'recent') {
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      }

      if (workerSort === 'workType') {
        const leftOrder =
          workTypes.find((workType) => workType.id === left.workTypeId)
            ?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder =
          workTypes.find((workType) => workType.id === right.workTypeId)
            ?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name, 'ko');
    });
  const selectedWorkTypeFilter = workTypes.find(
    (workType) => workType.id === filterWorkTypeId,
  );
  const selectedSortLabel =
    workerSortOptions.find((option) => option.value === workerSort)?.label ??
    '이름순';

  const closeListOptionAfterSelection = () => {
    setListOptionOpen(false);
  };

  const closeModal = () => {
    setOpen(false);
    setLoginId('');
    setName('');
    setPhone('');
    setSelectedWorkTypeId(null);
    setContactSelection(null);
    setCopied(false);
    setCreatedAccount(null);
  };

  const applyContact = (
    contactName: string,
    contactPhone: string,
    target: 'create' | 'edit',
  ) => {
    if (target === 'edit') {
      if (contactName) setEditName(contactName);
      setEditPhone(contactPhone);
    } else {
      if (contactName) setName(contactName);
      setPhone(contactPhone);
    }
    setContactSelection(null);
  };

  const pickContact = async (target: 'create' | 'edit') => {
    if (Platform.OS === 'web' || pickingContact) return;

    setPickingContact(true);
    try {
      if (Platform.OS === 'android') {
        const permission = await Contacts.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(
            '연락처 권한 필요',
            '연락처에서 작업자를 선택하려면 연락처 접근 권한이 필요합니다.',
          );
          return;
        }
      }

      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;

      const contactName =
        contact.name?.trim() ||
        [contact.firstName, contact.middleName, contact.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
      const phones = Array.from(
        new Set(
          (contact.phoneNumbers ?? [])
            .map((item) => normalizeContactPhone(item.number ?? ''))
            .filter((number) => /^01[016789][0-9]{7,8}$/.test(number)),
        ),
      );

      if (!phones.length) {
        Alert.alert(
          '휴대전화 번호 없음',
          '선택한 연락처에 사용할 수 있는 휴대전화 번호가 없습니다.',
        );
        return;
      }

      if (phones.length === 1) {
        applyContact(contactName, phones[0], target);
        return;
      }

      setContactSelection({ name: contactName, phones, target });
    } catch {
      Alert.alert('연락처 선택 실패', '연락처를 불러오지 못했습니다.');
    } finally {
      setPickingContact(false);
    }
  };

  const openEdit = (worker: (typeof workers)[number]) => {
    setEditingWorkerId(worker.id);
    setEditName(worker.name);
    setEditPhone(worker.phone ?? '');
    setEditWorkTypeId(worker.workTypeId);
    setContactSelection(null);
  };

  const closeEdit = () => {
    if (editBusy) return;
    setEditingWorkerId(null);
    setEditName('');
    setEditPhone('');
    setEditWorkTypeId(null);
    setContactSelection(null);
  };

  const submitEdit = async () => {
    if (!editingWorkerId || !editWorkTypeId) {
      Alert.alert('확인', '작업 종류를 선택해주세요.');
      return;
    }

    setEditBusy(true);
    const error = await updateWorker(editingWorkerId, {
      name: editName,
      phone: editPhone,
      workTypeId: editWorkTypeId,
    });
    setEditBusy(false);

    if (error) {
      Alert.alert('정보 변경 실패', error);
      return;
    }

    setEditingWorkerId(null);
    setEditName('');
    setEditPhone('');
    setEditWorkTypeId(null);
    setContactSelection(null);
  };

  const copyTemporaryPassword = async () => {
    if (!createdAccount) return;

    try {
      await Clipboard.setStringAsync(createdAccount.temporaryPassword);
      setCopied(true);
    } catch {
      Alert.alert('복사 실패', '임시 비밀번호를 복사하지 못했습니다.');
    }
  };

  const submit = async () => {
    if (!loginId.trim() || !name.trim() || !phone.trim()) {
      return Alert.alert(
        '확인',
        '이름, 로그인 아이디, 전화번호를 입력해주세요.',
      );
    }

    if (!selectedWorkTypeId) {
      return Alert.alert('확인', '작업 종류를 선택해주세요.');
    }

    setBusy(true);
    const result = await addWorker({
      loginId,
      name,
      phone,
      workTypeId: selectedWorkTypeId,
    });
    setBusy(false);

    if (result.error || !result.temporaryPassword) {
      return Alert.alert(
        '계정 생성 실패',
        result.error ?? '작업자 계정을 생성하지 못했습니다.',
      );
    }

    setCreatedAccount({
      loginId: loginId.trim().toLowerCase(),
      name: name.trim(),
      phone: phone.replace(/[^0-9]/g, ''),
      workTypeName: workTypes.find(
        (workType) => workType.id === selectedWorkTypeId,
      )?.name,
      temporaryPassword: result.temporaryPassword,
    });
    setCopied(false);
  };

  const performDelete = async (worker: (typeof workers)[number]) => {
    setBusyWorkerId(worker.id);
    const error = await deleteWorker(worker.id);
    setBusyWorkerId(null);

    if (error) Alert.alert('삭제 실패', error);
  };

  const confirmDelete = (worker: (typeof workers)[number]) => {
    const message = `${worker.name} 작업자 계정을 완전히 삭제하시겠습니까?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) void performDelete(worker);
      return;
    }

    Alert.alert('작업자 삭제', message, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => void performDelete(worker),
      },
    ]);
  };

  const performReset = async (worker: (typeof workers)[number]) => {
    setBusyWorkerId(worker.id);
    const result = await resetWorkerPassword(worker.id);
    setBusyWorkerId(null);

    if (result.error || !result.temporaryPassword) {
      Alert.alert(
        '초기화 실패',
        result.error ?? '비밀번호를 초기화하지 못했습니다.',
      );
      return;
    }

    setCreatedAccount({
      loginId: worker.loginId,
      name: worker.name,
      temporaryPassword: result.temporaryPassword,
    });
    setCopied(false);
    setOpen(true);
  };

  const confirmReset = (worker: (typeof workers)[number]) => {
    const message = `${worker.name} 작업자의 비밀번호를 초기화하시겠습니까?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) void performReset(worker);
      return;
    }

    Alert.alert('비밀번호 초기화', message, [
      { text: '취소', style: 'cancel' },
      { text: '초기화', onPress: () => void performReset(worker) },
    ]);
  };

  return (
    <>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={ui.title}>작업자</Text>
            <Text style={ui.subtitle}>
              {workers.length}명이 등록되어 있습니다.
            </Text>
          </View>
          <Pressable onPress={() => setOpen(true)} style={styles.add}>
            <Text style={styles.addText}>＋ 추가</Text>
          </Pressable>
        </View>

        <View style={styles.listControls}>
          <View style={styles.searchBox}>
            <View style={styles.searchIcon}>
              <View style={styles.searchIconCircle} />
              <View style={styles.searchIconHandle} />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="이름, 아이디, 전화번호 검색"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          <Pressable
            onPress={() => {
              setListOption('workType');
              setListOptionOpen(true);
            }}
            style={({ pressed }) => [
              styles.listOptionButton,
              pressed && styles.pressed,
            ]}
          >
            {selectedWorkTypeFilter ? (
              <View
                style={[
                  styles.filterColor,
                  { backgroundColor: selectedWorkTypeFilter.colorHex },
                ]}
              />
            ) : null}
            <Text numberOfLines={1} style={styles.listOptionText}>
              {selectedWorkTypeFilter?.name ?? '전체'}
            </Text>
            <View style={styles.optionChevron}>
              <View style={styles.optionChevronGlyph} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              setListOption('sort');
              setListOptionOpen(true);
            }}
            style={({ pressed }) => [
              styles.listOptionButton,
              pressed && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={styles.listOptionText}>
              {selectedSortLabel}
            </Text>
            <View style={styles.optionChevron}>
              <View style={styles.optionChevronGlyph} />
            </View>
          </Pressable>
        </View>
        <Text style={styles.resultCount}>검색 결과 {visibleWorkers.length}명</Text>

        {visibleWorkers.length ? (
          visibleWorkers.map((worker) => (
            <Card key={worker.id} style={styles.worker}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor:
                      workTypes.find(
                        (workType) => workType.id === worker.workTypeId,
                      )?.colorHex ?? colors.muted,
                  },
                ]}
              >
                <Text style={styles.workTypeAvatarText}>
                  {workTypes.find(
                    (workType) => workType.id === worker.workTypeId,
                  )?.name ?? '미지정'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{worker.name}</Text>
                <Text style={styles.id}>@{worker.loginId}</Text>
                {worker.phone ? (
                  <Text style={styles.phone}>{formatPhone(worker.phone)}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 7 }}>
                <Text
                  style={
                    worker.mustChangePassword ? styles.waiting : styles.ready
                  }
                >
                  {worker.mustChangePassword
                    ? '비밀번호 변경 전'
                    : '사용 중'}
                </Text>
                <Text style={styles.jobCount}>
                  {jobs.filter((job) => job.workerIds.includes(worker.id)).length}
                  개 작업
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    disabled={busyWorkerId === worker.id}
                    onPress={() => openEdit(worker)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.editText}>정보 변경</Text>
                  </Pressable>
                  <Pressable
                    disabled={busyWorkerId === worker.id}
                    onPress={() => confirmReset(worker)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.resetText}>비밀번호 초기화</Text>
                  </Pressable>
                  <Pressable
                    disabled={busyWorkerId === worker.id}
                    onPress={() => confirmDelete(worker)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.deleteText}>
                      {busyWorkerId === worker.id ? '처리 중' : '삭제'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Empty
            title={
              workers.length
                ? '조건에 맞는 작업자가 없습니다'
                : '등록된 작업자가 없습니다'
            }
            detail={
              workers.length
                ? '검색어나 작업 종류 필터를 변경해주세요.'
                : '작업자 계정을 추가해주세요.'
            }
          />
        )}
      </ScrollView>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          {createdAccount ? (
            <>
              <Text style={ui.title}>계정 생성 완료</Text>
              <Text style={ui.subtitle}>
                아래 정보를 작업자에게 안전하게 전달해주세요. 임시
                비밀번호는 이 화면을 닫으면 다시 확인할 수 없습니다.
              </Text>
              <Card style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>이름</Text>
                  <Text style={styles.resultValue}>
                    {createdAccount.name}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>로그인 아이디</Text>
                  <Text selectable style={styles.resultValue}>
                    {createdAccount.loginId}
                  </Text>
                </View>
                {createdAccount.phone ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>전화번호</Text>
                      <Text style={styles.resultValue}>
                        {formatPhone(createdAccount.phone)}
                      </Text>
                    </View>
                  </>
                ) : null}
                {createdAccount.workTypeName ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>작업 종류</Text>
                      <Text style={styles.resultValue}>
                        {createdAccount.workTypeName}
                      </Text>
                    </View>
                  </>
                ) : null}
                <View style={styles.divider} />
                <View style={styles.passwordBox}>
                  <Text style={styles.passwordLabel}>임시 비밀번호</Text>
                  <Text selectable style={styles.passwordValue}>
                    {createdAccount.temporaryPassword}
                  </Text>
                </View>
                <Button
                  title={
                    copied
                      ? '복사되었습니다 ✓'
                      : '임시 비밀번호 복사'
                  }
                  kind="secondary"
                  onPress={copyTemporaryPassword}
                />
              </Card>
              <Card style={styles.notice}>
                <Text style={styles.noticeTitle}>최초 로그인 안내</Text>
                <Text style={styles.noticeText}>
                  작업자는 이 임시 비밀번호로 로그인한 뒤 새 비밀번호를
                  반드시 설정해야 합니다.
                </Text>
              </Card>
              <Button title="확인했어요" onPress={closeModal} />
            </>
          ) : (
            <>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Text style={ui.title}>작업자 추가</Text>
                <Pressable onPress={closeModal}>
                  <Text style={styles.close}>닫기</Text>
                </Pressable>
              </View>
              <Text style={ui.subtitle}>
                작업자 정보와 작업 종류를 입력하면 안전한 임시 비밀번호가
                자동으로 생성됩니다.
              </Text>
              <Card style={{ gap: 16 }}>
                <Field
                  label="이름 *"
                  value={name}
                  onChangeText={setName}
                  placeholder="작업자 이름"
                />
                <Field
                  label="로그인 아이디 *"
                  value={loginId}
                  onChangeText={setLoginId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="영문 소문자/숫자 3~32자"
                />
                <Field
                  label="전화번호 *"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  placeholder="01012345678"
                />
                {Platform.OS !== 'web' ? (
                  <Pressable
                    disabled={pickingContact}
                    onPress={() => void pickContact('create')}
                    style={({ pressed }) => [
                      styles.contactButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.contactButtonText}>
                      {pickingContact ? '연락처 여는 중...' : '연락처에서 선택'}
                    </Text>
                  </Pressable>
                ) : null}
                {contactSelection?.target === 'create' ? (
                  <View style={styles.contactSelection}>
                    <Text style={styles.contactSelectionTitle}>
                      {contactSelection.name || '선택한 연락처'}의 전화번호를
                      선택해주세요.
                    </Text>
                    {contactSelection.phones.map((contactPhone) => (
                      <Pressable
                        key={contactPhone}
                        onPress={() =>
                          applyContact(
                            contactSelection.name,
                            contactPhone,
                            'create',
                          )
                        }
                        style={styles.contactPhoneOption}
                      >
                        <Text style={styles.contactPhoneText}>
                          {formatPhone(contactPhone)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.workTypeField}>
                  <Text style={styles.fieldLabel}>작업 종류 *</Text>
                  <View style={styles.workTypeGrid}>
                    {workTypes.map((workType) => {
                      const selected = selectedWorkTypeId === workType.id;
                      return (
                        <Pressable
                          key={workType.id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          onPress={() => setSelectedWorkTypeId(workType.id)}
                          style={[
                            styles.workTypeOption,
                            selected && {
                              borderColor: workType.colorHex,
                              backgroundColor: `${workType.colorHex}14`,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.radio,
                              selected && { borderColor: workType.colorHex },
                            ]}
                          >
                            {selected ? (
                              <View
                                style={[
                                  styles.radioSelected,
                                  { backgroundColor: workType.colorHex },
                                ]}
                              />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.workTypeName}>
                              {workType.name}
                            </Text>
                            {workType.note ? (
                              <Text style={styles.workTypeNote}>
                                {workType.note}
                              </Text>
                            ) : null}
                          </View>
                          <View
                            style={[
                              styles.optionColor,
                              { backgroundColor: workType.colorHex },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <Button
                  title={busy ? '계정 생성 중...' : '계정 생성'}
                  onPress={submit}
                  disabled={busy}
                />
              </Card>
            </>
          )}
        </ScrollView>
      </Modal>

      <Modal
        visible={Boolean(editingWorkerId)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEdit}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>작업자 정보 변경</Text>
            <Pressable disabled={editBusy} onPress={closeEdit}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <Text style={ui.subtitle}>
            작업자의 이름, 전화번호와 작업 종류를 변경할 수 있습니다.
          </Text>
          <Card style={{ gap: 16 }}>
            <Field
              label="이름 *"
              value={editName}
              onChangeText={setEditName}
              placeholder="작업자 이름"
            />
            <Field
              label="전화번호 *"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="01012345678"
            />
            {Platform.OS !== 'web' ? (
              <Pressable
                disabled={pickingContact}
                onPress={() => void pickContact('edit')}
                style={({ pressed }) => [
                  styles.contactButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.contactButtonText}>
                  {pickingContact ? '연락처 여는 중...' : '연락처에서 선택'}
                </Text>
              </Pressable>
            ) : null}
            {contactSelection?.target === 'edit' ? (
              <View style={styles.contactSelection}>
                <Text style={styles.contactSelectionTitle}>
                  {contactSelection.name || '선택한 연락처'}의 전화번호를
                  선택해주세요.
                </Text>
                {contactSelection.phones.map((contactPhone) => (
                  <Pressable
                    key={contactPhone}
                    onPress={() =>
                      applyContact(
                        contactSelection.name,
                        contactPhone,
                        'edit',
                      )
                    }
                    style={styles.contactPhoneOption}
                  >
                    <Text style={styles.contactPhoneText}>
                      {formatPhone(contactPhone)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.workTypeField}>
              <Text style={styles.fieldLabel}>작업 종류 *</Text>
              <View style={styles.workTypeGrid}>
                {workTypes.map((workType) => {
                  const selected = editWorkTypeId === workType.id;
                  return (
                    <Pressable
                      key={workType.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setEditWorkTypeId(workType.id)}
                      style={[
                        styles.workTypeOption,
                        selected && {
                          borderColor: workType.colorHex,
                          backgroundColor: `${workType.colorHex}14`,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          selected && { borderColor: workType.colorHex },
                        ]}
                      >
                        {selected ? (
                          <View
                            style={[
                              styles.radioSelected,
                              { backgroundColor: workType.colorHex },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={[styles.workTypeName, { flex: 1 }]}>
                        {workType.name}
                      </Text>
                      <View
                        style={[
                          styles.optionColor,
                          { backgroundColor: workType.colorHex },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Button
              title={editBusy ? '저장 중...' : '변경 내용 저장'}
              onPress={submitEdit}
              disabled={editBusy}
            />
          </Card>
        </ScrollView>
      </Modal>

      <Modal
        visible={listOptionOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setListOptionOpen(false)}
      >
        <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.title}>
              {listOption === 'workType' ? '작업 종류 선택' : '정렬 선택'}
            </Text>
            <Pressable onPress={() => setListOptionOpen(false)}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          {listOption === 'workType' ? (
            <Card style={styles.optionList}>
              <Pressable
                onPress={() => {
                  setFilterWorkTypeId(null);
                  closeListOptionAfterSelection();
                }}
                style={[
                  styles.optionRow,
                  filterWorkTypeId === null && styles.optionRowSelected,
                ]}
              >
                <Text style={styles.optionRowText}>전체</Text>
                {filterWorkTypeId === null ? (
                  <Text style={styles.optionCheck}>✓</Text>
                ) : null}
              </Pressable>
              {workTypes.map((workType) => (
                <Pressable
                  key={workType.id}
                  onPress={() => {
                    setFilterWorkTypeId(workType.id);
                    closeListOptionAfterSelection();
                  }}
                  style={[
                    styles.optionRow,
                    filterWorkTypeId === workType.id &&
                      styles.optionRowSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.filterColor,
                      { backgroundColor: workType.colorHex },
                    ]}
                  />
                  <Text style={[styles.optionRowText, { flex: 1 }]}>
                    {workType.name}
                  </Text>
                  {filterWorkTypeId === workType.id ? (
                    <Text style={styles.optionCheck}>✓</Text>
                  ) : null}
                </Pressable>
              ))}
            </Card>
          ) : (
            <Card style={styles.optionList}>
              {workerSortOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setWorkerSort(option.value);
                    closeListOptionAfterSelection();
                  }}
                  style={[
                    styles.optionRow,
                    workerSort === option.value && styles.optionRowSelected,
                  ]}
                >
                  <Text style={[styles.optionRowText, { flex: 1 }]}>
                    {option.label}
                  </Text>
                  {workerSort === option.value ? (
                    <Text style={styles.optionCheck}>✓</Text>
                  ) : null}
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  add: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  addText: { color: '#fff', fontWeight: '700' },
  listControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 9,
  },
  searchBox: {
    minWidth: 210,
    flexGrow: 1,
    flexBasis: 240,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  searchIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconCircle: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: colors.muted,
    borderRadius: 5,
  },
  searchIconHandle: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 7,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    paddingVertical: 0,
  },
  listOptionButton: {
    minWidth: 128,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  listOptionText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  optionChevron: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChevronGlyph: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }, { translateY: -1 }],
  },
  filterColor: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: 5,
  },
  resultCount: { color: colors.muted, fontSize: 12, marginTop: -3 },
  optionList: { gap: 7 },
  optionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionRowSelected: { backgroundColor: colors.primarySoft },
  optionRowText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  optionCheck: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  worker: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 58,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workTypeAvatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  name: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  id: { color: colors.muted, fontSize: 13, marginTop: 3 },
  phone: { color: colors.muted, fontSize: 13, marginTop: 3 },
  contactButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  contactButtonText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  contactSelection: {
    gap: 7,
    borderRadius: 12,
    backgroundColor: colors.background,
    padding: 12,
  },
  contactSelectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  contactPhoneOption: {
    borderRadius: 9,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contactPhoneText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  ready: { color: colors.success, fontWeight: '700', fontSize: 12 },
  waiting: { color: colors.warning, fontWeight: '700', fontSize: 12 },
  jobCount: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 6 },
  actionButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  deleteButton: { backgroundColor: '#FEECEB' },
  editText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  resetText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.55 },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  workTypeField: { gap: 8 },
  fieldLabel: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  workTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  workTypeOption: {
    width: '48%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { width: 10, height: 10, borderRadius: 5 },
  workTypeName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  workTypeNote: { color: colors.muted, fontSize: 10, marginTop: 2 },
  optionColor: { width: 10, height: 10, borderRadius: 5 },
  resultCard: { gap: 15 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: { color: colors.muted },
  resultValue: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  divider: { height: 1, backgroundColor: colors.border },
  passwordBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  passwordLabel: { color: colors.primary, fontWeight: '700' },
  passwordValue: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: 1.5,
  },
  notice: {
    backgroundColor: '#FFF8E8',
    borderColor: '#F4D99B',
    gap: 6,
  },
  noticeTitle: { color: colors.warning, fontWeight: '700' },
  noticeText: { color: '#7A5212', lineHeight: 20 },
});
