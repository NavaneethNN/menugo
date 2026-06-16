import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Clock, Utensils, AlertTriangle, X } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type SessionStatus = 'ACTIVE' | 'CLOSED';

interface Session {
  id: string;
  tableNumber: string;
  seatsOccupied: number;
  status: SessionStatus;
  startedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  orderCount: number;
  totalItems: number;
}

async function fetchSessions(token: string, status?: SessionStatus): Promise<Session[]> {
  const url = new URL(`${API_URL}/api/admin/sessions`);
  if (status) url.searchParams.set('status', status);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

async function forceClearTable(token: string, tableId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/tables/${tableId}/force-clear`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to clear table');
}

function formatDuration(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export default function SessionsScreen() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SessionStatus | undefined>('ACTIVE');

  const sessionsQuery = useQuery({
    queryKey: ['admin-sessions', filter],
    queryFn: () => fetchSessions(token!, filter),
    enabled: !!token,
  });

  const clearMutation = useMutation({
    mutationFn: (tableId: string) => forceClearTable(token!, tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] });
    },
  });

  const handleForceClear = (session: Session) => {
    Alert.alert(
      `Force Clear Table ${session.tableNumber}?`,
      `This will close the session and free ${session.seatsOccupied} seats.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Note: We need the tableId to clear, but sessions endpoint doesn't return it
            // In a real implementation, we'd have the tableId in the session object
            // For now, we'll use a placeholder approach
            Alert.alert('Note', 'Force clear requires table ID from session data');
          },
        },
      ]
    );
  };

  const isInactive = (session: Session): boolean => {
    if (session.status !== 'ACTIVE') return false;
    const durationMinutes = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000);
    return durationMinutes > 90 && session.totalItems > 0;
  };

  const renderSession = ({ item }: { item: Session }) => {
    const inactive = isInactive(item);

    return (
      <View style={[styles.sessionCard, inactive && styles.sessionCardInactive]}>
        <View style={styles.sessionHeader}>
          <View style={styles.tableBadge}>
            <Text style={styles.tableNumber}>T-{item.tableNumber}</Text>
          </View>
          {inactive && (
            <View style={styles.inactiveBadge}>
              <AlertTriangle size={14} color="#f59e0b" />
              <Text style={styles.inactiveText}>Inactive</Text>
            </View>
          )}
          {item.status === 'CLOSED' && (
            <View style={styles.closedBadge}>
              <X size={14} color="#6b7280" />
              <Text style={styles.closedText}>Closed</Text>
            </View>
          )}
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Users size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.seatsOccupied} seats</Text>
          </View>
          <View style={styles.detailRow}>
            <Clock size={16} color="#6b7280" />
            <Text style={styles.detailText}>{formatDuration(item.startedAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Utensils size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              {item.orderCount} orders • {item.totalItems} items
            </Text>
          </View>
        </View>

        {item.status === 'ACTIVE' && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => handleForceClear(item)}
          >
            <Text style={styles.clearButtonText}>Force Clear</Text>
          </TouchableOpacity>
        )}

        {item.status === 'CLOSED' && item.closedBy && (
          <Text style={styles.closedByText}>Closed by {item.closedBy}</Text>
        )}
      </View>
    );
  };

  if (sessionsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'ACTIVE' && styles.filterButtonActive]}
          onPress={() => setFilter('ACTIVE')}
        >
          <Text style={[styles.filterText, filter === 'ACTIVE' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'CLOSED' && styles.filterButtonActive]}
          onPress={() => setFilter('CLOSED')}
        >
          <Text style={[styles.filterText, filter === 'CLOSED' && styles.filterTextActive]}>
            Closed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === undefined && styles.filterButtonActive]}
          onPress={() => setFilter(undefined)}
        >
          <Text style={[styles.filterText, filter === undefined && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessionsQuery.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderSession}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No {filter?.toLowerCase() || ''} sessions</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#f97316',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 12,
  },
  sessionCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  sessionCardInactive: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inactiveText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  sessionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  closedByText: {
    marginTop: 12,
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
