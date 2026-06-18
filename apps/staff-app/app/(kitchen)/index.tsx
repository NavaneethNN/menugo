import { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';
import { playNewOrderAlert } from '@/lib/sound';
import type { OrderItemStatus } from '@restaurant/shared-types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

const NEXT_STATUS: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
};

const ACTION_LABEL: Partial<Record<OrderItemStatus, string>> = {
  PENDING: 'Accept',
  ACCEPTED: 'Start Preparing',
  PREPARING: 'Mark Ready',
};

const ACTION_COLOR: Partial<Record<OrderItemStatus, string>> = {
  PENDING: '#f97316',
  ACCEPTED: '#3b82f6',
  PREPARING: '#22c55e',
};

export default function KitchenScreen() {
  const { token, kitchenId, restaurantId } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const { data: items = [], isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['kitchen-orders', kitchenId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/kitchen/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderItemStatus }) => {
      const res = await fetch(`${API_BASE}/api/order-items/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-orders', kitchenId] }),
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!restaurantId || !token) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.emit('join_room', `restaurant:${restaurantId}:kitchen:${kitchenId}`);

    socket.on('order:new', () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders', kitchenId] });
      playNewOrderAlert();
    });

    return () => { socket.disconnect(); };
  }, [restaurantId, kitchenId, token, queryClient]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#f97316" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No pending orders 🎉</Text>
          </View>
        }
        renderItem={({ item }) => {
          const nextStatus = NEXT_STATUS[item.status as OrderItemStatus];
          const isReady = item.status === 'READY';
          return (
            <View style={[styles.card, isReady && styles.cardReady]}>
              <View style={styles.cardTop}>
                <Text style={styles.itemName}>{item.menuItem?.name ?? 'Item'}</Text>
                <Text style={styles.tableLabel}>
                  Table {item.order?.tableSession?.table?.tableNumber ?? '?'}
                </Text>
              </View>
              <Text style={styles.qty}>Qty: {item.quantity}</Text>
              {item.specialInstructions ? (
                <Text style={styles.note}>"{item.specialInstructions}"</Text>
              ) : null}
              <Text style={[
                styles.statusBadge,
                styles[`status_${item.status}` as keyof typeof styles] as any,
              ]}>
                {item.status}
              </Text>
              {nextStatus ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: ACTION_COLOR[item.status as OrderItemStatus] ?? '#f97316' }]}
                  onPress={() => statusMutation.mutate({ id: item.id, status: nextStatus })}
                  disabled={statusMutation.isPending}
                >
                  <Text style={styles.actionBtnText}>{ACTION_LABEL[item.status as OrderItemStatus]}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardReady: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  tableLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  qty: { fontSize: 14, color: '#374151', marginBottom: 4 },
  note: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', marginBottom: 8 },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, fontSize: 12, fontWeight: '600', marginBottom: 10,
    backgroundColor: '#f3f4f6', color: '#374151',
  },
  status_PENDING: { backgroundColor: '#fef3c7', color: '#92400e' },
  status_ACCEPTED: { backgroundColor: '#dbeafe', color: '#1e40af' },
  status_PREPARING: { backgroundColor: '#fed7aa', color: '#c2410c' },
  status_READY: { backgroundColor: '#dcfce7', color: '#166534' },
  actionBtn: { borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#9ca3af' },
});
