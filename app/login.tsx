import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { Button, Card, Field } from '@/components/UI';
import { useApp } from '@/store/AppContext';

export default function Login() {
  const { login } = useApp(); const [loginId, setLoginId] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); const message = await login(loginId, password); setBusy(false); if (message) return setError(message); router.replace('/'); };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}><View style={styles.hero}><View style={styles.logo}><Text style={styles.logoText}>W</Text></View><Text style={styles.title}>작업 일정 관리</Text><Text style={styles.subtitle}>현장과 일정을 한곳에서 간편하게</Text></View><Card style={styles.card}><Field label="아이디" value={loginId} onChangeText={setLoginId} autoCapitalize="none" placeholder="아이디를 입력하세요" /><Field label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry placeholder="비밀번호를 입력하세요" />{error ? <Text style={styles.error}>{error}</Text> : null}<Button title={busy ? '로그인 중...' : '로그인'} onPress={submit} disabled={busy || !loginId || !password} /></Card><View style={styles.demo}><Text style={styles.demoTitle}>체험 계정</Text><Text style={styles.demoText}>관리자  admin / admin123</Text><Text style={styles.demoText}>작업자  worker01 / 0000</Text></View></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 }, hero: { alignItems: 'center', marginBottom: 28 }, logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, logoText: { color: '#fff', fontSize: 30, fontWeight: '900' }, title: { color: colors.ink, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.muted, marginTop: 8 }, card: { gap: 16, padding: 20 }, error: { color: colors.danger, fontSize: 13 }, demo: { marginTop: 20, alignItems: 'center', gap: 4 }, demoTitle: { color: colors.muted, fontWeight: '700', marginBottom: 2 }, demoText: { color: '#8A94A6', fontSize: 12 } });
