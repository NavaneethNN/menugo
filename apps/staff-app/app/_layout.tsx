import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { initSound } from '@/lib/sound';
import { loadAuth } from '@/lib/storage';
import { useAuthStore } from '@/store/auth';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [ready, setReady] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    async function bootstrap() {
      try {
        initSound();
        const stored = await loadAuth();
        if (stored) {
          setAuth(stored);
        }
      } finally {
        setReady(true);
      }
    }
    bootstrap();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
