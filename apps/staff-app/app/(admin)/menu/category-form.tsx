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

interface CategoryFormProps {
  visible: boolean;
  onClose: () => void;
  category?: { id: string; name: string; sortOrder: number } | null;
}

async function createCategory(token: string, data: { name: string; sortOrder: number }) {
  const res = await fetch(`${API_URL}/api/admin/categories`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create category');
  return res.json();
}

async function updateCategory(token: string, id: string, data: { name: string; sortOrder: number }) {
  const res = await fetch(`${API_URL}/api/admin/categories/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update category');
  return res.json();
}

export default function CategoryForm({ visible, onClose, category }: CategoryFormProps) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder?.toString() ?? '0');

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        sortOrder: parseInt(sortOrder, 10) || 0,
      };
      if (category) {
        return updateCategory(token!, category.id, data);
      }
      return createCategory(token!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      onClose();
    },
  });

  const isValid = name.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {category ? 'Edit Category' : 'New Category'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Category name"
            />

            <Text style={styles.label}>Sort Order</Text>
            <TextInput
              style={styles.input}
              value={sortOrder}
              onChangeText={setSortOrder}
              keyboardType="numeric"
              placeholder="0"
            />

            {mutation.isError && (
              <Text style={styles.error}>Failed to save category</Text>
            )}

            <TouchableOpacity
              style={[styles.button, !isValid && styles.buttonDisabled]}
              onPress={() => mutation.mutate()}
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
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
