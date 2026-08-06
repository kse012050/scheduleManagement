import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppContext';

const Icon = ({ value, color }: { value: string; color: string }) => <Text style={{ color, fontSize: 19 }}>{value}</Text>;
export default function TabLayout() {
  const { ready, currentUser } = useApp();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.mustChangePassword) return <Redirect href="/change-password" />;
  const admin = currentUser.role === 'admin';
  return <Tabs screenOptions={{ headerShadowVisible: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: '#8A94A6', tabBarStyle: { height: 64, paddingTop: 6, paddingBottom: 8 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: ({ color }) => <Icon value="⌂" color={color} /> }} />
    <Tabs.Screen name="jobs" options={{ title: '작업', tabBarIcon: ({ color }) => <Icon value="▤" color={color} /> }} />
    <Tabs.Screen name="workers" options={{ title: '작업자', href: admin ? undefined : null, tabBarIcon: ({ color }) => <Icon value="♙" color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: '내 정보', tabBarIcon: ({ color }) => <Icon value="◉" color={color} /> }} />
  </Tabs>;
}
