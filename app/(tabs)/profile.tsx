import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, ui } from '@/components/UI';
import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppContext';

export default function Profile() {
  const { currentUser, logout, updateAdminPhone } = useApp();
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    setPhone(currentUser?.phone ?? '');
  }, [currentUser?.phone]);

  if (!currentUser) return null;

  const performLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const signOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('로그아웃하시겠습니까?')) {
        void performLogout();
      }
      return;
    }

    Alert.alert('로그아웃', '로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  const savePhone = async () => {
    setSavingPhone(true);
    const error = await updateAdminPhone(phone);
    setSavingPhone(false);

    if (error) {
      Alert.alert('전화번호 변경 실패', error);
      return;
    }

    Alert.alert('저장 완료', '관리자 전화번호가 변경되었습니다.');
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>내 정보</Text>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser.name.slice(0, 1)}</Text>
        </View>
        <Text style={styles.name}>{currentUser.name}</Text>
        <Text style={ui.badge}>{currentUser.role === 'admin' ? '관리자' : '작업자'}</Text>
      </Card>
      <Card style={{ gap: 15 }}>
        <View style={styles.line}>
          <Text style={styles.label}>아이디</Text>
          <Text style={styles.value}>{currentUser.loginId}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.line}>
          <Text style={styles.label}>권한</Text>
          <Text style={styles.value}>
            {currentUser.role === 'admin' ? '전체 관리' : '배정 작업 및 내 일정 관리'}
          </Text>
        </View>
      </Card>
      {currentUser.role === 'admin' ? (
        <Card style={{ gap: 12 }}>
          <Field
            label="관리자 전화번호"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
            placeholder="01012345678"
          />
          <Button
            title={savingPhone ? '저장 중...' : '전화번호 저장'}
            onPress={savePhone}
            disabled={savingPhone}
          />
        </Card>
      ) : null}
      <Button title="로그아웃" kind="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: 9, paddingVertical: 25 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 28 },
  name: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.muted },
  value: { color: colors.ink, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },
});
