'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = sessionStorage.getItem('sessionId');
    const restaurantId = sessionStorage.getItem('restaurantId');
    if (sessionId && restaurantId) {
      router.replace(`/menu/${restaurantId}`);
    }
  }, [router]);

  useEffect(() => {
    if (searchParams) {
      setError(searchParams.get('error'));
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 mb-4">
          <span className="text-4xl font-bold text-brand-600">M</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">MenuGo</h1>
        <p className="text-gray-500">
          Scan the QR code on your table to start ordering.
        </p>
        {error === 'session_expired' && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            Your session has expired. Please scan the QR code again.
          </div>
        )}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
