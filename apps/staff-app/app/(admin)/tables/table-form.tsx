import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface TableFormProps {
  visible: boolean;
  onClose: () => void;
  table?: { id: string; tableNumber: string; totalSeats: number } | null;
}

async function createTable(token: string, data: { tableNumber: string; totalSeats: number }) {
  const res = await fetch(`${API_URL}/api/admin/tables`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create table');
  return res.json();
}

async function updateTable(token: string, id: string, data: { tableNumber: string; totalSeats: number }) {
  const res = await fetch(`${API_URL}/api/admin/tables/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update table');
  return res.json();
}

export default function TableForm({ visible, onClose, table }: TableFormProps) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [tableNumber, setTableNumber] = useState(table?.tableNumber ?? '');
  const [totalSeats, setTotalSeats] = useState(table?.totalSeats?.toString() ?? '4');

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        tableNumber: tableNumber.trim(),
        totalSeats: parseInt(totalSeats, 10) || 4,
      };
      if (table) {
        return updateTable(token!, table.id, data);
      }
      return createTable(token!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] });
      onClose();
    },
  });

  const isValid = tableNumber.trim().length > 0 && parseInt(totalSeats, 10) > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{table ? 'Edit Table' : 'New Table'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Table Number</Text>
            <TextInput
              style={styles.input}
              value={tableNumber}
              onChangeText={setTableNumber}
              placeholder="e.g., T1, 12A"
            />

            <Text style={styles.label}>Total Seats</Text>
            <TextInput
              style={styles.input}
              value={totalSeats}
              onChangeText={setTotalSeats}
              keyboardType="numeric"
              placeholder="4"
            />

            {mutation.isError && <Text style={styles.error}>Failed to save table</Text>}

            <TouchableOpacity
              style={[styles.button, !isValid && styles.buttonDisabled]}
              onPress={() => mutation.mutate()}
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    color: '#ef4444',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#f97316',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
