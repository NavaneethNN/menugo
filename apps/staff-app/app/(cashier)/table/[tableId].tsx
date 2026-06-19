import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Users, CheckCircle, AlertCircle } from 'lucide-react-native';

interface OrderItem {
  name: string;
  quantity: number;
  price: string;
  subtotal: string;
  status: string;
}

interface SessionSummary {
  sessionId: string;
  seatsOccupied: number;
  startedAt: string;
  durationMinutes: number;
  orders: { orderId: string; placedAt: string; items: OrderItem[] }[];
  sessionTotal: string;
  allServed: boolean;
}

interface TableRow {
  tableId: string;
  tableNumber: string;
  totalSeats: number;
  availableSeats: number;
  activeSessions: SessionSummary[];
}

export default function TableSessionsScreen() {
  const { tableId } = useLocalSearchParams<{ tableId: string }>();
  const queryClient = useQueryClient();

  const tables = queryClient.getQueryData<TableRow[]>(['cashier-tables']) ?? [];
  const table = tables.find((t) => t.tableId === tableId);

  if (!table) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Table not found</Text>
      </View>
    );
  }

  if (table.activeSessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No active sessions for Table {table.tableNumber}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableTitle}>Table {table.tableNumber}</Text>
        <Text style={styles.tableSubtitle}>
          {table.totalSeats - table.availableSeats} / {table.totalSeats} seats occupied
        </Text>
      </View>

      <FlatList
        data={table.activeSessions}
        keyExtractor={(s) => s.sessionId}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item: session, index }) => {
          const isInactive = session.durationMinutes > 90 && session.allServed;
          return (
            <TouchableOpacity
              style={[styles.card, session.allServed && styles.cardServed]}
              onPress={() => router.push(`/(cashier)/session/${session.sessionId}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <Text style={styles.sessionLabel}>Session {index + 1}</Text>
                <View style={styles.badgeRow}>
                  {session.allServed && (
                    <View style={styles.badgeServed}>
                      <CheckCircle size={12} color="#166534" />
                      <Text style={styles.badgeServedText}>All Served</Text>
                    </View>
                  )}
                  {isInactive && (
                    <View style={styles.badgeInactive}>
                      <AlertCircle size={12} color="#92400e" />
                      <Text style={styles.badgeInactiveText}>Inactive</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Users size={14} color="#6b7280" />
                  <Text style={styles.metaText}>{session.seatsOccupied} seat{session.seatsOccupied !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={14} color="#6b7280" />
                  <Text style={styles.metaText}>{session.durationMinutes} min</Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.totalLabel}>
                  {session.orders.length} order{session.orders.length !== 1 ? 's' : ''} ·{' '}
                  Closing frees {session.seatsOccupied} seat{session.seatsOccupied !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.totalAmount}>₹{session.sessionTotal}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tableHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tableTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  tableSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardServed: { borderWidth: 1.5, borderColor: '#bbf7d0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sessionLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badgeServed: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeServedText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  badgeInactive: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fef3c7', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeInactiveText: { fontSize: 11, fontWeight: '600', color: '#92400e' },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#6b7280' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  totalLabel: { fontSize: 12, color: '#9ca3af' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#111827' },
  emptyText: { fontSize: 16, color: '#9ca3af' },
});
