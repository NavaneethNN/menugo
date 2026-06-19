import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

export default function CashierLayout() {
  const { name, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#10b981' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 4, padding: 4 }}>
            <LogOut size={20} color="#fff" />
          </TouchableOpacity>
        ),
        headerShown: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: name ?? 'Counter' }} />
      <Stack.Screen name="table/[tableId]" options={{ title: 'Table Sessions' }} />
      <Stack.Screen name="session/[sessionId]" options={{ title: 'Bill' }} />
    </Stack>
  );
}
