import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth';
import type { OrderItemStatus } from '@restaurant/shared-types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  status: string;
  createdAt: string;
  tableSession: {
    table: {
      tableNumber: string;
    };
  };
  items: WaiterOrderItem[];
}

function badgeColorStyle(status: OrderItemStatus): object {
  switch (status) {
    case 'PENDING':   return { backgroundColor: '#fef3c7' };
    case 'ACCEPTED':  return { backgroundColor: '#dbeafe' };
    case 'PREPARING': return { backgroundColor: '#fed7aa' };
    case 'READY':     return { backgroundColor: '#dcfce7' };
    case 'SERVED':    return { backgroundColor: '#f1f5f9' };
    default:          return { backgroundColor: '#f1f5f9' };
  }
}

export default function WaiterOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const { data: order, isLoading } = useQuery<WaiterOrder>({
    queryKey: ['waiter-order', id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/waiter/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const orders: WaiterOrder[] = await res.json();
      const found = orders.find((o) => o.id === id);
      if (!found) throw new Error('Order not found');
      return found;
    },
  });

  useEffect(() => {
    if (order) {
      navigation.setOptions({ headerTitle: `Order — Table ${order.tableSession.table.tableNumber}` });
    }
  }, [order, navigation]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const serveMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const res = await fetch(`${API_BASE}/api/orders/${id}/served`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemIds }),
      });
      if (!res.ok) throw new Error('Failed to mark served');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-orders'] });
      queryClient.invalidateQueries({ queryKey: ['waiter-order', id] });
      setSelectedIds(new Set());
      navigation.goBack();
    },
  });

  if (isLoading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const tableNumber = order.tableSession.table.tableNumber;

  function toggleItem(itemId: string, status: OrderItemStatus) {
    if (status !== 'READY') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleMarkServed() {
    if (selectedIds.size === 0) return;
    serveMutation.mutate(Array.from(selectedIds));
  }

  const readyCount = order.items.filter((i) => i.status === 'READY').length;
  const hasSelection = selectedIds.size > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Order — Table {tableNumber}</Text>
        <Text style={styles.headerSub}>{readyCount} item{readyCount !== 1 ? 's' : ''} ready</Text>
      </View>

      <FlatList
        data={order.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const isReady = item.status === 'READY';
          const isSelected = selectedIds.has(item.id);

          return (
            <TouchableOpacity
              style={[
                styles.itemCard,
                isSelected && styles.itemCardSelected,
                !isReady && styles.itemCardDisabled,
              ]}
              onPress={() => toggleItem(item.id, item.status)}
              activeOpacity={isReady ? 0.7 : 1}
            >
              <View style={styles.checkboxArea}>
                <View style={[
                  styles.checkbox,
                  isSelected && styles.checkboxChecked,
                  !isReady && styles.checkboxDisabled,
                ]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </View>

              <View style={styles.itemBody}>
                <View style={styles.itemTop}>
                  <Text style={[styles.itemName, !isReady && styles.textMuted]}>
                    {item.menuItemName}
                  </Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                </View>
                <Text style={styles.kitchenLabel}>{item.kitchenName}</Text>
                {item.specialInstructions ? (
                  <Text style={styles.note}>"{item.specialInstructions}"</Text>
                ) : null}
              </View>

              <View style={[styles.badge, badgeColorStyle(item.status)]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.serveBtn, !hasSelection && styles.serveBtnDisabled]}
          onPress={handleMarkServed}
          disabled={!hasSelection || serveMutation.isPending}
        >
          <Text style={styles.serveBtnText}>
            {serveMutation.isPending
              ? 'Marking...'
              : `Mark ${selectedIds.size > 0 ? selectedIds.size : ''} Selected as Served`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },

  itemCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    borderWidth: 2, borderColor: 'transparent',
  },
  itemCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  itemCardDisabled: { opacity: 0.55 },

  checkboxArea: { justifyContent: 'center' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxDisabled: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },

  itemBody: { flex: 1 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1e293b', flex: 1 },
  textMuted: { color: '#94a3b8' },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#475569' },
  kitchenLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  note: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#334155' },

  footer: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  serveBtn: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  serveBtnDisabled: { backgroundColor: '#cbd5e1' },
  serveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
