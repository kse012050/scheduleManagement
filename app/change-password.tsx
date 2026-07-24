import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { Button, Card, Field, ui } from '@/components/UI';
import { useApp } from '@/store/AppContext';

export default function ChangePassword() {
  const { changePassword } = useApp(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const submit = async () => { if (password.length < 6) return Alert.alert('확인', '비밀번호는 6자 이상으로 입력해주세요.'); if (password !== confirm) return Alert.alert('확인', '비밀번호가 서로 다릅니다.'); await changePassword(password); router.replace('/'); };
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content}><Text style={ui.title}>새 비밀번호를{`\n`}설정해주세요</Text><Text style={ui.subtitle}>초기 비밀번호로 로그인했습니다. 안전한 사용을 위해 비밀번호 변경이 필요합니다.</Text><Card style={{ gap: 16 }}><Field label="새 비밀번호" value={password} onChangeText={setPassword} secureTextEntry placeholder="6자 이상 입력" /><Field label="비밀번호 확인" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="한 번 더 입력" /><Button title="변경하고 시작하기" onPress={submit} /></Card></ScrollView>;
}
