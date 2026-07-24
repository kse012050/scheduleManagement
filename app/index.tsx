import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useApp } from '@/store/AppContext';

export default function Index() {
  const { ready, currentUser } = useApp();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.mustChangePassword) return <Redirect href="/change-password" />;
  return <Redirect href="/(tabs)" />;
}
