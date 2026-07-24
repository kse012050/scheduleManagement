import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/store/AppContext';

export default function RootLayout() {
  return <AppProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShadowVisible: false, headerBackTitle: '뒤로' }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="login" options={{ headerShown: false }} />
    <Stack.Screen name="change-password" options={{ title: '비밀번호 변경', headerLeft: () => null }} />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="job/[id]" options={{ title: '작업 일정' }} />
  </Stack></AppProvider>;
}
