import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChefHat, Pencil, Trash2, Utensils, Users } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Kitchen {
  id: string;
  name: string;
  _count?: { menuItems: number; staff: number };
}

async function fetchKitchens(token: string): Promise<Kitchen[]> {
  const res = await fetch(`${API_URL}/api/admin/kitchens`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch kitchens');
  return res.json();
}

async function createKitchen(token: string, name: string): Promise<Kitchen> {
  const res = await fetch(`${API_URL}/api/admin/kitchens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create kitchen');
  return res.json();
}

async function updateKitchen(token: string, id: string, name: string): Promise<Kitchen> {
  const res = await fetch(`${API_URL}/api/admin/kitchens/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to update kitchen');
  return res.json();
}

async function deleteKitchen(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/kitchens/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete kitchen');
}

export default function KitchensScreen() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const kitchensQuery = useQuery({
    queryKey: ['admin-kitchens'],
    queryFn: () => fetchKitchens(token!),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createKitchen(token!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kitchens'] });
      setNewName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateKitchen(token!, id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kitchens'] });
      setEditingId(null);
      setEditName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKitchen(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kitchens'] });
    },
  });

  const handleDelete = (kitchen: Kitchen) => {
    const hasItems = (kitchen._count?.menuItems ?? 0) > 0;
    const hasStaff = (kitchen._count?.staff ?? 0) > 0;

    if (hasItems || hasStaff) {
      Alert.alert(
        'Cannot Delete',
        `This kitchen has ${hasItems ? 'menu items' : ''}${hasItems && hasStaff ? ' and ' : ''}${hasStaff ? 'assigned staff' : ''}. Please reassign them first.`
      );
      return;
    }

    Alert.alert('Delete Kitchen', `Are you sure you want to delete "${kitchen.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(kitchen.id),
      },
    ]);
  };

  const startEdit = (kitchen: Kitchen) => {
    setEditingId(kitchen.id);
    setEditName(kitchen.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, name: editName.trim() });
    }
  };

  const renderKitchen = ({ item }: { item: Kitchen }) => {
    const isEditing = editingId === item.id;

    return (
      <View style={styles.kitchenCard}>
        <View style={styles.kitchenIcon}>
          <ChefHat size={24} color="#f97316" />
        </View>

        <View style={styles.kitchenInfo}>
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              onSubmitEditing={saveEdit}
              autoFocus
            />
          ) : (
            <Text style={styles.kitchenName}>{item.name}</Text>
          )}

          <View style={styles.kitchenStats}>
            <View style={styles.stat}>
              <Utensils size={14} color="#6b7280" />
              <Text style={styles.statText}>{item._count?.menuItems ?? 0} items</Text>
            </View>
            <View style={styles.stat}>
              <Users size={14} color="#6b7280" />
              <Text style={styles.statText}>{item._count?.staff ?? 0} staff</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {isEditing ? (
            <TouchableOpacity style={styles.actionButton} onPress={saveEdit}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => startEdit(item)}>
                <Pencil size={18} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  if (kitchensQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kitchens</Text>
      </View>

      <View style={styles.addSection}>
        <TextInput
          style={styles.addInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="New kitchen name"
        />
        <TouchableOpacity
          style={[styles.addButton, !newName.trim() && styles.addButtonDisabled]}
          onPress={() => newName.trim() && createMutation.mutate(newName.trim())}
          disabled={!newName.trim()}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={kitchensQuery.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderKitchen}
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
  addSection: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#f97316',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  list: {
    padding: 12,
  },
  kitchenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  kitchenIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  kitchenInfo: {
    flex: 1,
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '600',
  },
  editInput: {
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#f97316',
    borderRadius: 4,
    padding: 4,
  },
  kitchenStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  saveText: {
    color: '#f97316',
    fontWeight: '600',
  },
});
