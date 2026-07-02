'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ChevronRight, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ScanPage({ params }: { params: { token: string } }): JSX.Element {
  const router = useRouter();
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: params.token, seatsOccupied: seats }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(`Table is full. Only ${data.availableSeats} seat(s) available.`);
        } else {
          setError(data.error ?? 'Something went wrong.');
        }
        return;
      }

      // Store session in sessionStorage for the duration of the visit
      sessionStorage.setItem('sessionId', data.sessionId);
      sessionStorage.setItem('sessionToken', data.sessionToken);
      sessionStorage.setItem('restaurantId', data.restaurantId);
      sessionStorage.setItem('workflowMode', data.workflowMode);
      sessionStorage.setItem('tableNumber', data.tableNumber);

      router.push(`/menu/${data.restaurantId}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 mb-4">
            <Users className="w-8 h-8 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="mt-2 text-gray-500">How many people are dining today?</p>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setSeats((s) => Math.max(1, s - 1))}
            className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 text-2xl font-bold hover:bg-gray-200 transition-colors"
          >
            −
          </button>
          <span className="text-5xl font-bold text-brand-600 w-12 text-center">{seats}</span>
          <button
            onClick={() => setSeats((s) => s + 1)}
            className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 text-2xl font-bold hover:bg-gray-200 transition-colors"
          >
            +
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-brand-500 text-white font-semibold text-lg flex items-center justify-center gap-2 hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <>
              See the menu <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </main>
  );
}
