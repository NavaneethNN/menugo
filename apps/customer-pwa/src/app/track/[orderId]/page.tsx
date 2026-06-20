'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { CheckCircle, Clock, ChefHat, PackageCheck, WifiOff, MapPin } from 'lucide-react';
import type { Order, OrderItemStatus } from '@restaurant/shared-types';
import type { 
  OrderItemStatusUpdateEvent,
  OrderPartiallyReadyEvent,
  OrderFullyReadyEvent,
  OrderItemReadyForPickupEvent,
  OrderCompletedEvent,
  SessionClosedEvent
} from '@restaurant/shared-types';

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
  ACCEPTED: 'bg-blue-100 text-blue-600',
  PREPARING: 'bg-orange-100 text-orange-600',
  READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-brand-100 text-brand-700',
};

export default function TrackPage({ params }: { params: { orderId: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [readyItems, setReadyItems] = useState<Map<string, string>>(new Map());
  const [allItemsReady, setAllItemsReady] = useState(false);
  const [collectingItems, setCollectingItems] = useState<Set<string>>(new Set());

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

    const socket = io(SOCKET_URL, { 
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    // Reconnection handling
    let reconnectTimeout: NodeJS.Timeout;
    socket.on('disconnect', () => {
      setIsReconnecting(true);
      reconnectTimeout = setTimeout(() => {
        setIsReconnecting(false);
      }, 3000);
    });

    socket.on('connect', () => {
      setIsReconnecting(false);
      clearTimeout(reconnectTimeout);
    });

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

    socket.on('order:partially_ready', (data: OrderPartiallyReadyEvent) => {
      queryClient.setQueryData<Order>(['order', params.orderId], (old) => {
        if (!old) return old;
        return { ...old, status: 'PARTIALLY_READY' };
      });
    });

    socket.on('order:item_ready_for_pickup', (data: OrderItemReadyForPickupEvent) => {
      setReadyItems((prev) => new Map(prev).set(data.orderItemId, data.kitchenName));
      queryClient.setQueryData<Order>(['order', params.orderId], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item) =>
            item.id === data.orderItemId ? { ...item, status: 'READY' } : item
          ),
        };
      });
    });

    socket.on('order:fully_ready', (data: OrderFullyReadyEvent) => {
      setAllItemsReady(true);
      queryClient.setQueryData<Order>(['order', params.orderId], (old) => {
        if (!old) return old;
        return { ...old, status: 'FULLY_READY' };
      });
    });

    socket.on('order:completed', (data: OrderCompletedEvent) => {
      setReadyItems(new Map());
      setAllItemsReady(false);
      queryClient.setQueryData<Order>(['order', params.orderId], (old) => {
        if (!old) return old;
        return {
          ...old,
          status: 'COMPLETED',
          items: old.items.map((item) => ({ ...item, status: 'SERVED' })),
        };
      });
    });

    socket.on('session:closed', (data: SessionClosedEvent) => {
      setSessionEnded(true);
    });

    return () => {
      socket.disconnect();
      clearTimeout(reconnectTimeout);
    };
  }, [params.orderId, queryClient]);

  if (isLoading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const allServed = order.items.every((i) => i.status === 'SERVED');
  const allReady = order.items.every((i) => i.status === 'READY' || i.status === 'SERVED');

  async function markCollected(orderItemId: string) {
    const sessionToken = sessionStorage.getItem('sessionToken');
    if (!sessionToken) return;
    setCollectingItems((prev) => new Set(prev).add(orderItemId));
    try {
      await fetch(`${API_BASE}/api/order-items/${orderItemId}/collected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
      });
    } finally {
      setCollectingItems((prev) => { const next = new Set(prev); next.delete(orderItemId); return next; });
    }
  }
  const anyReady = order.items.some((i) => i.status === 'READY');
  const workflowMode = order.workflowMode;

  const kitchenGroups = order.items.reduce<Map<string, { kitchenName: string; items: typeof order.items }>>(
    (acc, item) => {
      if (!acc.has(item.kitchenName)) acc.set(item.kitchenName, { kitchenName: item.kitchenName, items: [] });
      acc.get(item.kitchenName)!.items.push(item);
      return acc;
    },
    new Map()
  );

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      {/* Reconnection Banner */}
      {isReconnecting && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-orange-600" />
          <p className="text-sm text-orange-800">Reconnecting...</p>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">Order Tracker</h1>
        <p className="text-sm text-gray-500">Table {sessionStorage.getItem('tableNumber')}</p>
      </header>

      {/* Status Banner */}
      <div className="mx-4 mt-4">
        {sessionEnded && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">Your session has ended. You can no longer place new orders.</p>
          </div>
        )}
        {allServed && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">All done! Enjoy your meal.</p>
            </div>
          </div>
        )}
        {workflowMode === 'SELF_COLLECTION' && !allServed && (
          <>
            {allItemsReady ? (
              <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3 animate-pulse">
                <PackageCheck className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-bold text-green-800">All items ready — collect from the counters!</p>
                  <p className="text-sm text-green-600">Head to each kitchen to pick up your order.</p>
                </div>
              </div>
            ) : readyItems.size > 0 ? (
              <div className="space-y-2">
                {Array.from(
                  new Map(
                    [...readyItems.entries()].reduce<Map<string, string[]>>((acc, [itemId, kitchen]) => {
                      if (!acc.has(kitchen)) acc.set(kitchen, []);
                      acc.get(kitchen)!.push(itemId);
                      return acc;
                    }, new Map())
                  )
                ).map(([kitchen]) => (
                  <div
                    key={kitchen}
                    className="rounded-2xl bg-brand-50 border border-brand-200 p-4 flex items-center gap-3 animate-pulse"
                  >
                    <PackageCheck className="w-6 h-6 text-brand-600 shrink-0" />
                    <div>
                      <p className="font-bold text-brand-800">Ready at {kitchen}!</p>
                      <p className="text-sm text-brand-600">
                        {order.items
                          .filter((i) => readyItems.get(i.id) === kitchen)
                          .map((i) => `${i.quantity}× ${i.menuItemName}`)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-brand-500 mt-0.5">Please collect from the counter.</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
        {!allServed && workflowMode === 'MANAGED_DINING' && (
          <>
            {allReady ? (
              <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3 animate-pulse">
                <PackageCheck className="w-6 h-6 text-green-600 shrink-0" />
                <p className="text-sm text-green-800">All items are ready — your server is on the way!</p>
              </div>
            ) : anyReady ? (
              <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 flex items-center gap-3">
                <PackageCheck className="w-6 h-6 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-800">Some items are ready — your server is on the way!</p>
              </div>
            ) : null}
          </>
        )}
        {!allServed && workflowMode === 'ASSISTED_DINING' && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">Order received. Your server will bring everything shortly.</p>
          </div>
        )}
      </div>

      {/* Kitchen Map — Self Collection only */}
      {workflowMode === 'SELF_COLLECTION' && !allServed && (
        <div className="mx-4 mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Where to collect</p>
          <div className="space-y-2">
            {Array.from(kitchenGroups.values()).map(({ kitchenName, items: kItems }) => {
              const hasReady = kItems.some((i) => i.status === 'READY');
              return (
                <div
                  key={kitchenName}
                  className={`rounded-2xl p-3 flex items-start gap-3 border ${
                    hasReady
                      ? 'bg-brand-50 border-brand-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${hasReady ? 'text-brand-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${hasReady ? 'text-brand-800' : 'text-gray-700'}`}>
                      {kitchenName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {kItems.map((i) => `${i.quantity}× ${i.menuItemName}`).join(', ')}
                    </p>
                  </div>
                  {hasReady && (
                    <span className="text-xs font-medium text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full shrink-0">
                      Ready
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="mx-4 mt-4 space-y-3">
        {order.items.map((item) => {
          const statusKey = item.status as OrderItemStatus;
          const canCollect = workflowMode === 'SELF_COLLECTION' && item.status === 'READY';
          const isCollecting = collectingItems.has(item.id);
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{item.menuItemName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                  {item.specialInstructions && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">
                      "{item.specialInstructions}"
                    </p>
                  )}
                </div>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLOR[statusKey]}`}
                >
                  {STATUS_ICONS[statusKey]}
                  {STATUS_LABELS[statusKey]}
                </div>
              </div>
              {canCollect && (
                <button
                  onClick={() => markCollected(item.id)}
                  disabled={isCollecting}
                  className="mt-3 w-full py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                >
                  {isCollecting ? 'Marking...' : "I've collected this"}
                </button>
              )}
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
          disabled={sessionEnded}
          className={`w-full py-3 rounded-2xl border-2 font-semibold transition-colors ${
            sessionEnded
              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
              : 'border-brand-500 text-brand-600 hover:bg-brand-50'
          }`}
        >
          + Order more
        </button>
      </div>
    </div>
  );
}
