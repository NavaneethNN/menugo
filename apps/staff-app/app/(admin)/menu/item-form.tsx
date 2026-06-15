import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ItemFormProps {
  visible: boolean;
  onClose: () => void;
  item?: {
    id: string;
    name: string;
    description: string | null;
    price: string;
    imageUrl: string | null;
    categoryId: string;
    kitchenId: string;
    isAvailable: boolean;
  } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Kitchen {
  id: string;
  name: string;
}

async function fetchCategories(token: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/admin/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

async function fetchKitchens(token: string): Promise<Kitchen[]> {
  const res = await fetch(`${API_URL}/api/admin/kitchens`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch kitchens');
  return res.json();
}

async function createItem(token: string, data: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/admin/menu-items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create item');
  return res.json();
}

async function updateItem(token: string, id: string, data: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/admin/menu-items/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update item');
  return res.json();
}

export default function ItemForm({ visible, onClose, item }: ItemFormProps) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item?.price ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [kitchenId, setKitchenId] = useState(item?.kitchenId ?? '');
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => fetchCategories(token!),
    enabled: visible && !!token,
  });

  const kitchensQuery = useQuery({
    queryKey: ['admin-kitchens'],
    queryFn: () => fetchKitchens(token!),
    enabled: visible && !!token,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        imageUrl: imageUrl.trim() || null,
        categoryId,
        kitchenId,
        isAvailable,
      };
      if (item) {
        return updateItem(token!, item.id, data);
      }
      return createItem(token!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      onClose();
    },
  });

  const isValid = name.trim().length > 0 && parseFloat(price) > 0 && categoryId && kitchenId;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{item ? 'Edit Item' : 'New Item'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Item name" />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              multiline
            />

            <Text style={styles.label}>Price (₹) *</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Image URL</Text>
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://..."
              autoCapitalize="none"
            />

            <Text style={styles.label}>Category *</Text>
            <View style={styles.options}>
              {categoriesQuery.data?.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.option, categoryId === cat.id && styles.optionSelected]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[styles.optionText, categoryId === cat.id && styles.optionTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Kitchen *</Text>
            <View style={styles.options}>
              {kitchensQuery.data?.map((kitchen) => (
                <TouchableOpacity
                  key={kitchen.id}
                  style={[styles.option, kitchenId === kitchen.id && styles.optionSelected]}
                  onPress={() => setKitchenId(kitchen.id)}
                >
                  <Text style={[styles.optionText, kitchenId === kitchen.id && styles.optionTextSelected]}>
                    {kitchen.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Available</Text>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
                trackColor={{ false: '#d1d5db', true: '#f97316' }}
              />
            </View>

            {mutation.isError && <Text style={styles.error}>Failed to save item</Text>}

            <TouchableOpacity
              style={[styles.button, !isValid && styles.buttonDisabled]}
              onPress={() => mutation.mutate()}
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
            </TouchableOpacity>
          </ScrollView>
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
    maxHeight: '80%',
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
  multiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  optionSelected: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
