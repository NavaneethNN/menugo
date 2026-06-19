import { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

interface SessionSummary {
  sessionId: string;
  seatsOccupied: number;
  durationMinutes: number;
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

export default function CashierDashboard() {
  const { token, restaurantId } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const { width } = useWindowDimensions();
  const numColumns = width >= 600 ? 2 : 1;

  const { data: tables = [], isLoading, isRefetching, refetch } = useQuery<TableRow[]>({
    queryKey: ['cashier-tables'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/cashier/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tables');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!restaurantId || !token) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token } });
    socketRef.current = socket;

    socket.emit('join_room', `restaurant:${restaurantId}:cashier`);

    socket.on('table:seats_updated', (data: { tableId: string; availableSeats: number }) => {
      queryClient.setQueryData<TableRow[]>(['cashier-tables'], (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.tableId === data.tableId ? { ...t, availableSeats: data.availableSeats } : t
        );
      });
    });

    socket.on('session:closed', () => {
      queryClient.invalidateQueries({ queryKey: ['cashier-tables'] });
    });

    return () => { socket.disconnect(); };
  }, [restaurantId, token, queryClient]);

  function handleForceClear(table: TableRow) {
    Alert.alert(
      `Force Clear Table ${table.tableNumber}?`,
      `This will close all ${table.activeSessions.length} active session${table.activeSessions.length !== 1 ? 's' : ''} and free all seats. Use this for end-of-day or abandoned tables.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_BASE}/api/tables/${table.tableId}/force-clear`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
              });
              queryClient.invalidateQueries({ queryKey: ['cashier-tables'] });
            } catch {}
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const totalActiveSessions = tables.reduce((acc, t) => acc + t.activeSessions.length, 0);

  return (
    <View style={styles.container}>
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {totalActiveSessions} active session{totalActiveSessions !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={tables}
        key={numColumns}
        keyExtractor={(item) => item.tableId}
        numColumns={numColumns}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#10b981" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tables found</Text>
          </View>
        }
        renderItem={({ item: table }) => {
          const isOccupied = table.activeSessions.length > 0;
          const isFull = table.availableSeats === 0;
          const seatColor = !isOccupied ? '#10b981' : isFull ? '#ef4444' : '#f59e0b';

          return (
            <TouchableOpacity
              style={[
                styles.card,
                numColumns > 1 && styles.cardHalf,
                !isOccupied && styles.cardAvailable,
              ]}
              onPress={() => isOccupied && router.push(`/(cashier)/table/${table.tableId}`)}
              onLongPress={() => isOccupied && handleForceClear(table)}
              activeOpacity={isOccupied ? 0.7 : 1}
            >
              <Text style={[styles.tableNumber, !isOccupied && styles.tableNumberDim]}>
                {table.tableNumber}
              </Text>

              {!isOccupied ? (
                <Text style={styles.availableLabel}>Available</Text>
              ) : (
                <>
                  <View style={[styles.seatPill, { backgroundColor: seatColor + '22', borderColor: seatColor }]}>
                    <Text style={[styles.seatPillText, { color: seatColor }]}>
                      {table.totalSeats - table.availableSeats} / {table.totalSeats} seats
                    </Text>
                  </View>

                  <View style={styles.sessionBadge}>
                    <Text style={styles.sessionBadgeText}>
                      {table.activeSessions.length} session{table.activeSessions.length !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  <Text style={styles.tapHint}>Tap to view · Hold to clear</Text>
                </>
              )}
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
  statsBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statsText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  cardHalf: { flex: 1 },
  cardAvailable: { opacity: 0.5 },
  tableNumber: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 8 },
  tableNumberDim: { color: '#9ca3af' },
  availableLabel: { fontSize: 14, color: '#10b981', fontWeight: '600' },
  seatPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  seatPillText: { fontSize: 12, fontWeight: '600' },
  sessionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  sessionBadgeText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  tapHint: { fontSize: 11, color: '#9ca3af' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#9ca3af' },
});
