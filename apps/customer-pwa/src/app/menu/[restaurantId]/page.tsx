'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ShoppingCart, Minus, Plus, ChevronRight, Loader2 } from 'lucide-react';
import type { MenuResponse } from '@restaurant/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CartItem {
  menuItemId: string;
  name: string;
  price: string;
  quantity: number;
  specialInstructions: string;
}

export default function MenuPage({ params }: { params: { restaurantId: string } }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      router.replace('/?error=session_expired');
    }
  }, [router]);

  const { data, isLoading } = useQuery<MenuResponse>({
    queryKey: ['menu', params.restaurantId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/restaurants/${params.restaurantId}/menu`);
      if (!res.ok) throw new Error('Failed to load menu');
      return res.json();
    },
  });

  const totalItems = Object.values(cart).reduce((s, i) => s + i.quantity, 0);
  const totalPrice = Object.values(cart).reduce(
    (s, i) => s + parseFloat(i.price) * i.quantity,
    0
  );

  function addToCart(item: { id: string; name: string; price: string }) {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: existing ? existing.quantity + 1 : 1,
          specialInstructions: existing?.specialInstructions ?? '',
        },
      };
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...existing, quantity: existing.quantity - 1 } };
    });
  }

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const sessionId = sessionStorage.getItem('sessionId');
      const sessionToken = sessionStorage.getItem('sessionToken');
      if (!sessionId || !sessionToken) throw new Error('Session expired');

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionToken,
          items: Object.values(cart).map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            specialInstructions: i.specialInstructions || undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed to place order');
      return res.json();
    },
    onSuccess: (order) => {
      setCart({});
      setShowCart(false);
      router.push(`/track/${order.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Menu</h1>
        <p className="text-sm text-gray-500">
          Table {sessionStorage.getItem('tableNumber') ?? ''}
        </p>
      </header>

      <div className="px-4 py-4 space-y-8">
        {data?.categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="text-base font-semibold text-gray-700 mb-3 uppercase tracking-wide text-xs">
              {cat.name}
            </h2>
            <div className="space-y-3">
              {cat.menuItems.map((item) => {
                const qty = cart[item.id]?.quantity ?? 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100"
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-brand-600 font-semibold text-sm mt-1">
                        ₹{parseFloat(String(item.price)).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qty > 0 ? (
                        <>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-4 text-center font-bold text-sm">{qty}</span>
                        </>
                      ) : null}
                      <button
                        onClick={() =>
                          addToCart({
                            id: item.id,
                            name: item.name,
                            price: String(item.price),
                          })
                        }
                        className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <button
            onClick={() => placeOrderMutation.mutate()}
            disabled={placeOrderMutation.isPending}
            className="w-full py-4 rounded-2xl bg-brand-500 text-white font-semibold flex items-center justify-between px-5 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {totalItems} item{totalItems > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              {placeOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Place order · ₹{totalPrice.toFixed(2)}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
