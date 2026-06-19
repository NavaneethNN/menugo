import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { router } from 'expo-router';

import { useAuthStore } from '@/store/auth';
import { playNewOrderAlert, playReadyToServeAlert } from '@/lib/sound';
import type { OrderStatus, OrderItemStatus } from '@restaurant/shared-types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

interface WaiterOrderItem {
  id: string;
  menuItemName: string;
  kitchenName: string;
  quantity: number;
  specialInstructions: string | null;
  status: OrderItemStatus;
}

interface WaiterOrder {
  id: string;
  status: OrderStatus;
  createdAt: string;
  workflowMode: string;
  tableSession: {
    table: {
      tableNumber: string;
    };
  };
  items: WaiterOrderItem[];
}

interface Section {
  title: string;
  sectionStatus: OrderStatus | 'PLACED';
  data: WaiterOrder[];
}

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function badgeColorStyle(status: OrderItemStatus): object {
  switch (status) {
    case 'PENDING':  return { backgroundColor: '#fef3c7' };
    case 'ACCEPTED': return { backgroundColor: '#dbeafe' };
    case 'PREPARING': return { backgroundColor: '#fed7aa' };
    case 'READY':   return { backgroundColor: '#dcfce7' };
    case 'SERVED':  return { backgroundColor: '#f1f5f9' };
    default:        return { backgroundColor: '#f1f5f9' };
  }
}

function ItemStatusBadge({ status }: { status: OrderItemStatus }) {
  return (
    <View style={[styles.badge, badgeColorStyle(status)]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
}

function OrderCard({
  order,
  onServeAll,
  onServeReady,
  onAcknowledge,
  isPending,
  acknowledged,
}: {
  order: WaiterOrder;
  onServeAll: (id: string) => void;
  onServeReady: (id: string, itemIds: string[]) => void;
  onAcknowledge: (id: string) => void;
  isPending: boolean;
  acknowledged: boolean;
}) {
  const tableNumber = order.tableSession.table.tableNumber;
  const handleCardPress = () => router.push(`/(waiter)/order/${order.id}`);
  const shortId = order.id.slice(-4).toUpperCase();
  const isFullyReady = order.status === 'FULLY_READY';
  const isPartiallyReady = order.status === 'PARTIALLY_READY';
  const isPlaced = order.status === 'PLACED';

  const readyItemIds = order.items
    .filter((i) => i.status === 'READY')
    .map((i) => i.id);

  return (
    <TouchableOpacity
      style={[styles.card, isFullyReady && styles.cardFullyReady]}
      onPress={handleCardPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.tableNumber}>Table {tableNumber}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.orderId}>#{shortId}</Text>
          <Text style={styles.timeAgo}>{timeAgo(order.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.itemList}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.menuItemName}</Text>
              <Text style={styles.itemKitchen}>{item.kitchenName}</Text>
            </View>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
            <ItemStatusBadge status={item.status} />
          </View>
        ))}
      </View>

      {order.items.some((i) => i.specialInstructions) && order.items.filter((i) => i.specialInstructions).map((i) => (
        <Text key={i.id} style={styles.note}>"{i.specialInstructions}"</Text>
      ))}

      {isFullyReady && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGreen]}
          onPress={() => onServeAll(order.id)}
          disabled={isPending}
        >
          <Text style={styles.actionBtnText}>✓ Mark All Served</Text>
        </TouchableOpacity>
      )}

      {isPartiallyReady && readyItemIds.length > 0 && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnBlue]}
          onPress={() => onServeReady(order.id, readyItemIds)}
          disabled={isPending}
        >
          <Text style={styles.actionBtnText}>Mark Ready Items Served</Text>
        </TouchableOpacity>
      )}

      {isPlaced && !acknowledged && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGray]}
          onPress={() => onAcknowledge(order.id)}
        >
          <Text style={styles.actionBtnText}>Acknowledged</Text>
        </TouchableOpacity>
      )}

      {isPlaced && acknowledged && (
        <View style={styles.acknowledgedBanner}>
          <Text style={styles.acknowledgedText}>Acknowledged</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function WaiterScreen() {
  const { token, restaurantId } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const { data: orders = [], isLoading, isRefetching, refetch } = useQuery<WaiterOrder[]>({
    queryKey: ['waiter-orders'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/waiter/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch waiter orders');
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const serveMutation = useMutation({
    mutationFn: async ({ orderId, itemIds }: { orderId: string; itemIds?: string[] }) => {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/served`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(itemIds ? { itemIds } : {}),
      });
      if (!res.ok) throw new Error('Failed to mark served');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waiter-orders'] }),
  });

  const handleServeAll = useCallback((orderId: string) => {
    serveMutation.mutate({ orderId });
  }, [serveMutation]);

  const handleServeReady = useCallback((orderId: string, itemIds: string[]) => {
    serveMutation.mutate({ orderId, itemIds });
  }, [serveMutation]);

  const handleAcknowledge = useCallback((orderId: string) => {
    setAcknowledgedIds((prev) => new Set(prev).add(orderId));
  }, []);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!restaurantId || !token) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.emit('join_room', `restaurant:${restaurantId}:waiter`);

    socket.on('order:new_full', () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-orders'] });
      playNewOrderAlert();
    });

    socket.on('order:partially_ready', () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-orders'] });
    });

    socket.on('order:fully_ready', () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-orders'] });
      playReadyToServeAlert();
    });

    return () => { socket.disconnect(); };
  }, [restaurantId, token, queryClient]);

  const visibleOrders = orders.filter(
    (o) => !(o.status === 'PLACED' && acknowledgedIds.has(o.id)),
  );

  const fullyReady = visibleOrders.filter((o) => o.status === 'FULLY_READY');
  const partiallyReady = visibleOrders.filter((o) => o.status === 'PARTIALLY_READY');
  const placed = visibleOrders.filter((o) => o.status === 'PLACED');

  const sections: Section[] = [
    fullyReady.length > 0 && { title: 'Ready to Serve', sectionStatus: 'FULLY_READY' as const, data: fullyReady },
    partiallyReady.length > 0 && { title: 'Partially Ready', sectionStatus: 'PARTIALLY_READY' as const, data: partiallyReady },
    placed.length > 0 && { title: 'New Orders', sectionStatus: 'PLACED' as const, data: placed },
  ].filter(Boolean) as Section[];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{visibleOrders.length}</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={[
            styles.sectionHeader,
            section.sectionStatus === 'FULLY_READY' && styles.sectionHeaderGreen,
            section.sectionStatus === 'PARTIALLY_READY' && styles.sectionHeaderAmber,
            section.sectionStatus === 'PLACED' && styles.sectionHeaderBlue,
          ]}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onServeAll={handleServeAll}
            onServeReady={handleServeReady}
            onAcknowledge={handleAcknowledge}
            isPending={serveMutation.isPending}
            acknowledged={acknowledgedIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CheckCircle size={56} color="#22c55e" strokeWidth={1.5} />
            <Text style={styles.emptyText}>All clear!</Text>
            <Text style={styles.emptySubText}>No pending orders.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  countBadge: {
    backgroundColor: '#2563eb', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 6,
  },
  sectionHeaderGreen: { backgroundColor: '#dcfce7' },
  sectionHeaderAmber: { backgroundColor: '#fef3c7' },
  sectionHeaderBlue: { backgroundColor: '#dbeafe' },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  sectionCount: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardFullyReady: { borderLeftWidth: 4, borderLeftColor: '#22c55e' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tableNumber: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  cardMeta: { alignItems: 'flex-end', gap: 2 },
  orderId: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  timeAgo: { fontSize: 12, color: '#94a3b8' },

  itemList: { gap: 8, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemKitchen: { fontSize: 12, color: '#94a3b8' },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#475569', minWidth: 28, textAlign: 'right' },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#334155' },

  note: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 },

  actionBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  actionBtnGreen: { backgroundColor: '#22c55e' },
  actionBtnBlue: { backgroundColor: '#3b82f6' },
  actionBtnGray: { backgroundColor: '#94a3b8' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  acknowledgedBanner: {
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#f1f5f9', marginTop: 4,
  },
  acknowledgedText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 20, fontWeight: '700', color: '#22c55e' },
  emptySubText: { fontSize: 14, color: '#94a3b8' },
});

