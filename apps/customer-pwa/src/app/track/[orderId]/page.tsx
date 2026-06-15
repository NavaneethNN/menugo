'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { CheckCircle, Clock, ChefHat, PackageCheck } from 'lucide-react';
import type { Order, OrderItemStatus } from '@restaurant/shared-types';
import type { OrderItemStatusUpdateEvent } from '@restaurant/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

const STATUS_LABELS: Record<OrderItemStatus, string> = {
  PENDING: 'Received',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
};

const STATUS_ICONS: Record<OrderItemStatus, React.ReactNode> = {
  PENDING: <Clock className="w-4 h-4" />,
  ACCEPTED: <Clock className="w-4 h-4" />,
  PREPARING: <ChefHat className="w-4 h-4" />,
  READY: <PackageCheck className="w-4 h-4" />,
  SERVED: <CheckCircle className="w-4 h-4" />,
};

const STATUS_COLOR: Record<OrderItemStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-500',
  ACCEPTED: 'bg-yellow-100 text-yellow-600',
  PREPARING: 'bg-orange-100 text-orange-600',
  READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-brand-100 text-brand-700',
};

export default function TrackPage({ params }: { params: { orderId: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ['order', params.orderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/orders/${params.orderId}`);
      if (!res.ok) throw new Error('Order not found');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join_room', `session:${sessionId}`);

    socket.on('order_item:status_update', (data: OrderItemStatusUpdateEvent) => {
      queryClient.setQueryData<Order>(['order', params.orderId], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item) =>
            item.id === data.orderItemId ? { ...item, status: data.status } : item
          ),
        };
      });
    });

    socket.on('order:completed', () => {
      queryClient.invalidateQueries({ queryKey: ['order', params.orderId] });
    });

    return () => {
      socket.disconnect();
    };
  }, [params.orderId, queryClient]);

  const workflowMode = sessionStorage.getItem('workflowMode') ?? 'MANAGED_DINING';

  if (isLoading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const allServed = order.items.every((i) => i.status === 'SERVED');
  const allReady = order.items.every((i) => i.status === 'READY' || i.status === 'SERVED');
  const anyReady = order.items.some((i) => i.status === 'READY');

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">Order Tracker</h1>
        <p className="text-sm text-gray-500">Table {sessionStorage.getItem('tableNumber')}</p>
      </header>

      {/* Status Banner */}
      <div className="mx-4 mt-4">
        {allServed && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">All done! Enjoy your meal.</p>
            </div>
          </div>
        )}
        {!allServed && allReady && workflowMode === 'SELF_COLLECTION' && (
          <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 flex items-center gap-3 animate-pulse">
            <PackageCheck className="w-6 h-6 text-brand-600 shrink-0" />
            <div>
              <p className="font-bold text-brand-800">Your order is ready for pickup!</p>
              <p className="text-sm text-brand-600">Please collect from the counter.</p>
            </div>
          </div>
        )}
        {!allServed && !allReady && anyReady && workflowMode === 'MANAGED_DINING' && (
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 flex items-center gap-3">
            <PackageCheck className="w-6 h-6 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">Some items are ready — your server is on the way!</p>
          </div>
        )}
        {!allServed && workflowMode === 'ASSISTED_DINING' && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">Order received. Your server will bring everything shortly.</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mx-4 mt-4 space-y-3">
        {order.items.map((item) => {
          const statusKey = item.status as OrderItemStatus;
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">
                  {(item as any).menuItem?.name ?? 'Item'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                {item.specialInstructions && (
                  <p className="text-xs text-gray-400 mt-0.5 italic">
                    "{item.specialInstructions}"
                  </p>
                )}
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLOR[statusKey]}`}
              >
                {STATUS_ICONS[statusKey]}
                {STATUS_LABELS[statusKey]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order more */}
      <div className="mx-4 mt-6">
        <button
          onClick={() => {
            const restaurantId = sessionStorage.getItem('restaurantId');
            if (restaurantId) router.push(`/menu/${restaurantId}`);
          }}
          className="w-full py-3 rounded-2xl border-2 border-brand-500 text-brand-600 font-semibold hover:bg-brand-50 transition-colors"
        >
          + Order more
        </button>
      </div>
    </div>
  );
}
