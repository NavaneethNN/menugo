import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Users } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface OrderItem {
  name: string;
  quantity: number;
  price: string;
  subtotal: string;
  status: string;
}

interface Order {
  orderId: string;
  placedAt: string;
  items: OrderItem[];
}

interface SessionDetail {
  sessionId: string;
  seatsOccupied: number;
  startedAt: string;
  durationMinutes: number;
  orders: Order[];
  sessionTotal: string;
  allServed: boolean;
}

interface TableRow {
  tableId: string;
  tableNumber: string;
  totalSeats: number;
  availableSeats: number;
  activeSessions: SessionDetail[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  ACCEPTED: '#3b82f6',
  PREPARING: '#f97316',
  READY: '#22c55e',
  SERVED: '#10b981',
};

export default function SessionBillScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const [isClosing, setIsClosing] = useState(false);

  const tables = queryClient.getQueryData<TableRow[]>(['cashier-tables']) ?? [];
  let session: SessionDetail | undefined;
  let tableNumber = '';
  let tableId = '';

  for (const table of tables) {
    const found = table.activeSessions.find((s) => s.sessionId === sessionId);
    if (found) {
      session = found;
      tableNumber = table.tableNumber;
      tableId = table.tableId;
      break;
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Session not found</Text>
      </View>
    );
  }

  async function handleSettle() {
    if (!session) return;
    Alert.alert(
      'Settle & Close Session?',
      `This will free ${session.seatsOccupied} seat${session.seatsOccupied !== 1 ? 's' : ''} at Table ${tableNumber}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle & Close',
          onPress: async () => {
            setIsClosing(true);
            try {
              const res = await fetch(`${API_BASE}/api/sessions/${session!.sessionId}/close`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error('Failed to close session');
              queryClient.invalidateQueries({ queryKey: ['cashier-tables'] });
              router.replace(`/(cashier)/table/${tableId}`);
            } catch {
              Alert.alert('Error', 'Failed to close session. Please try again.');
            } finally {
              setIsClosing(false);
            }
          },
        },
      ]
    );
  }

  const placedAt = new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Session header */}
        <View style={styles.sessionHeader}>
          <Text style={styles.tableTitle}>Table {tableNumber}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Users size={14} color="#6b7280" />
              <Text style={styles.metaText}>{session.seatsOccupied} seat{session.seatsOccupied !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color="#6b7280" />
              <Text style={styles.metaText}>{session.durationMinutes} min · started {placedAt}</Text>
            </View>
          </View>
          {session.allServed && (
            <View style={styles.allServedBadge}>
              <CheckCircle size={14} color="#166534" />
              <Text style={styles.allServedText}>All items served</Text>
            </View>
          )}
        </View>

        {/* Orders breakdown */}
        {session.orders.map((order, oi) => {
          const orderTotal = order.items
            .reduce((acc, i) => acc + Number(i.subtotal), 0)
            .toFixed(2);
          return (
            <View key={order.orderId} style={styles.orderBlock}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderLabel}>Order {oi + 1}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {order.items.map((item, ii) => (
                <View key={ii} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>{item.quantity} × ₹{item.price}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemSubtotal}>₹{item.subtotal}</Text>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? '#9ca3af' }]} />
                  </View>
                </View>
              ))}

              <View style={styles.orderFooter}>
                <Text style={styles.orderTotalLabel}>Order subtotal</Text>
                <Text style={styles.orderTotalAmount}>₹{orderTotal}</Text>
              </View>
            </View>
          );
        })}

        {/* Session total */}
        <View style={styles.sessionTotalBlock}>
          <Text style={styles.sessionTotalLabel}>Session Total</Text>
          <Text style={styles.sessionTotalAmount}>₹{session.sessionTotal}</Text>
        </View>

        <Text style={styles.seatsNote}>
          Closing this session frees {session.seatsOccupied} seat{session.seatsOccupied !== 1 ? 's' : ''}.
        </Text>
      </ScrollView>

      {/* Sticky settle button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.settleBtn, isClosing && styles.settleBtnDisabled]}
          onPress={handleSettle}
          disabled={isClosing}
          activeOpacity={0.8}
        >
          {isClosing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.settleBtnText}>Settle &amp; Close</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#9ca3af' },
  sessionHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  tableTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#6b7280' },
  allServedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#dcfce7', borderRadius: 999,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
  },
  allServedText: { fontSize: 12, fontWeight: '600', color: '#166534' },
  orderBlock: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  orderLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  orderTime: { fontSize: 13, color: '#9ca3af' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  itemQty: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemSubtotal: { fontSize: 14, fontWeight: '600', color: '#374151' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  orderTotalLabel: { fontSize: 13, color: '#6b7280' },
  orderTotalAmount: { fontSize: 14, fontWeight: '700', color: '#374151' },
  sessionTotalBlock: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 8,
    borderWidth: 2, borderColor: '#10b981',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sessionTotalLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  sessionTotalAmount: { fontSize: 28, fontWeight: '800', color: '#111827' },
  seatsNote: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 8 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  settleBtn: {
    backgroundColor: '#10b981', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  settleBtnDisabled: { opacity: 0.6 },
  settleBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
