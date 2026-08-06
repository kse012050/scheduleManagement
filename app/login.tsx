import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/theme';
import { Button, Card, Field } from '@/components/UI';
import { useApp } from '@/store/AppContext';

export default function Login() {
  const { ready, currentUser, login } = useApp();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (currentUser?.mustChangePassword) {
    return <Redirect href="/change-password" />;
  }
  if (currentUser) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setBusy(true);
    setError('');

    try {
      const message = await login(loginId, password);
      if (message) {
        setError(message);
        return;
      }
      router.replace('/');
    } catch {
      setError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>W</Text>
        </View>
        <Text style={styles.title}>작업 일정 관리</Text>
        <Text style={styles.subtitle}>현장과 일정을 한곳에서 간편하게</Text>
      </View>
      <Card style={styles.card}>
        <Field
          label="아이디"
          value={loginId}
          onChangeText={setLoginId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="아이디를 입력하세요"
        />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="비밀번호를 입력하세요"
          onSubmitEditing={() => {
            if (!busy && loginId && password) void submit();
          }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={busy ? '로그인 중...' : '로그인'}
          onPress={submit}
          disabled={busy || !loginId || !password}
        />
      </Card>
      <Text style={styles.help}>
        관리자가 발급한 아이디와 비밀번호로 로그인해주세요.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  hero: { alignItems: 'center', marginBottom: 28 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, marginTop: 8 },
  card: { gap: 16, padding: 20 },
  error: { color: colors.danger, fontSize: 13 },
  help: {
    marginTop: 20,
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
