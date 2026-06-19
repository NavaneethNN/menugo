import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { LogOut } from 'lucide-react-native';

import { useAuthStore } from '@/store/auth';

export default function WaiterLayout() {
  const { name, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#2563eb' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerTitle: name ?? 'Waiter',
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 4, padding: 4 }}>
            <LogOut size={20} color="#fff" />
          </TouchableOpacity>
        ),
        headerShown: true,
      }}
    />
  );
}
