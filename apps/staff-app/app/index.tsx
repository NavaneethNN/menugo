import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  if (!token) return <Redirect href="/login" />;

  switch (role) {
    case 'KITCHEN': return <Redirect href="/(kitchen)" />;
    case 'WAITER':  return <Redirect href="/(waiter)" />;
    case 'CASHIER': return <Redirect href="/(cashier)" />;
    case 'ADMIN':   return <Redirect href="/(admin)" />;
    default:        return <Redirect href="/login" />;
  }
}
