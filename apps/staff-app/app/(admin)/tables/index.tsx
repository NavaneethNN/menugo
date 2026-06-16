import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, QrCode, Users, Pencil, Trash2 } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'expo-router';
import TableForm from './table-form';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Table {
  id: string;
  tableNumber: string;
  totalSeats: number;
  qrToken: string;
  activeSessions: number;
  availableSeats: number;
}

async function fetchTables(token: string): Promise<Table[]> {
  const res = await fetch(`${API_URL}/api/admin/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch tables');
  return res.json();
}

async function deleteTable(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/tables/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete table');
}

export default function TablesScreen() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formVisible, setFormVisible] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const tablesQuery = useQuery({
    queryKey: ['admin-tables'],
    queryFn: () => fetchTables(token!),
    enabled: !!token,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTable(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] });
    },
  });

  const handleEdit = (table: Table) => {
    setEditingTable(table);
    setFormVisible(true);
  };

  const handleAdd = () => {
    setEditingTable(null);
    setFormVisible(true);
  };

  const handleQR = (table: Table) => {
    router.push(`/(admin)/tables/${table.id}/qr`);
  };

  const renderTable = ({ item }: { item: Table }) => {
    const isFull = item.availableSeats === 0;
    const seatColor = isFull ? '#ef4444' : item.availableSeats < item.totalSeats ? '#f97316' : '#22c55e';

    return (
      <View style={styles.tableCard}>
        <View style={styles.tableInfo}>
          <Text style={styles.tableNumber}>Table {item.tableNumber}</Text>
          <View style={styles.seatInfo}>
            <Users size={16} color={seatColor} />
            <Text style={[styles.seatText, { color: seatColor }]}>
              {item.totalSeats - item.availableSeats} / {item.totalSeats} occupied
            </Text>
          </View>
          {item.activeSessions > 0 && (
            <Text style={styles.sessionText}>{item.activeSessions} active sessions</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.qrButton} onPress={() => handleQR(item)}>
            <QrCode size={20} color="#f97316" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => handleEdit(item)}>
            <Pencil size={18} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => deleteMutation.mutate(item.id)}
            disabled={item.activeSessions > 0}
          >
            <Trash2 size={18} color={item.activeSessions > 0 ? '#d1d5db' : '#ef4444'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (tablesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tables</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Table</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tablesQuery.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderTable}
      />

      <TableForm
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        table={editingTable}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  list: {
    padding: 12,
  },
  tableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tableInfo: {
    flex: 1,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: '600',
  },
  seatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  seatText: {
    marginLeft: 4,
    fontSize: 14,
  },
  sessionText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrButton: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#fff7ed',
  },
  iconButton: {
    padding: 10,
  },
});
