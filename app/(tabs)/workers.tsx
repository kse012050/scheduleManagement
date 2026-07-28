import { Redirect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Empty, Field, ui } from '@/components/UI';
import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppContext';

type CreatedAccount = {
  loginId: string;
  name: string;
  temporaryPassword: string;
};

export default function Workers() {
  const {
    currentUser,
    users,
    jobs,
    addWorker,
    deleteWorker,
    resetWorkerPassword,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyWorkerId, setBusyWorkerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdAccount, setCreatedAccount] =
    useState<CreatedAccount | null>(null);

  if (!currentUser || currentUser.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  const workers = users.filter((user) => user.role === 'worker');

  const closeModal = () => {
    setOpen(false);
    setLoginId('');
    setName('');
    setCopied(false);
    setCreatedAccount(null);
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
    if (!loginId.trim() || !name.trim()) {
      return Alert.alert('확인', '이름과 로그인 아이디를 입력해주세요.');
    }

    setBusy(true);
    const result = await addWorker({ loginId, name });
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

        {workers.length ? (
          workers.map((worker) => (
            <Card key={worker.id} style={styles.worker}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {worker.name.slice(0, 1)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{worker.name}</Text>
                <Text style={styles.id}>@{worker.loginId}</Text>
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
            title="등록된 작업자가 없습니다"
            detail="작업자 계정을 추가해주세요."
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
                이름과 아이디를 입력하면 안전한 임시 비밀번호가 자동으로
                생성됩니다.
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
  worker: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  name: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  id: { color: colors.muted, fontSize: 13, marginTop: 3 },
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
  resetText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.55 },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
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
