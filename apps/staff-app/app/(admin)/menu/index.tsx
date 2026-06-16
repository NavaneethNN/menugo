import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';
import CategoryForm from './category-form';
import ItemForm from './item-form';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { menuItems: number };
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  kitchenId: string;
  category: { id: string; name: string };
  kitchen: { id: string; name: string };
}

async function fetchCategories(token: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/admin/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

async function fetchMenuItems(token: string): Promise<MenuItem[]> {
  const res = await fetch(`${API_URL}/api/admin/menu-items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch menu items');
  return res.json();
}

async function toggleAvailability(token: string, id: string, isAvailable: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/menu-items/${id}/availability`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isAvailable }),
  });
  if (!res.ok) throw new Error('Failed to toggle availability');
}

export default function MenuScreen() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryFormVisible, setCategoryFormVisible] = useState(false);
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => fetchCategories(token!),
    enabled: !!token,
  });

  const itemsQuery = useQuery({
    queryKey: ['admin-menu-items'],
    queryFn: () => fetchMenuItems(token!),
    enabled: !!token,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      toggleAvailability(token!, id, isAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
    },
  });

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedCategories(newSet);
  };

  const itemsByCategory = (categoryId: string) =>
    itemsQuery.data?.filter((item) => item.categoryId === categoryId) ?? [];

  if (categoriesQuery.isLoading || itemsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.addButton, styles.addButtonSecondary]}
            onPress={() => {
              setEditingCategory(null);
              setCategoryFormVisible(true);
            }}
          >
            <Plus size={18} color="#f97316" />
            <Text style={styles.addButtonTextSecondary}>Category</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingItem(null);
              setItemFormVisible(true);
            }}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.addButtonText}>Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {categoriesQuery.data?.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleExpand(category.id)}
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown size={20} color="#6b7280" />
              ) : (
                <ChevronRight size={20} color="#6b7280" />
              )}
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.itemCount}>
                {itemsByCategory(category.id).length} items
              </Text>
            </TouchableOpacity>

            {expandedCategories.has(category.id) && (
              <FlatList
                data={itemsByCategory(category.id)}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.itemCard}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemDetails}>
                        ₹{item.price} • {item.kitchen.name}
                      </Text>
                      {item.description && (
                        <Text style={styles.itemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.itemActions}>
                      <Switch
                        value={item.isAvailable}
                        onValueChange={(value) =>
                          toggleMutation.mutate({ id: item.id, isAvailable: value })
                        }
                        trackColor={{ false: '#d1d5db', true: '#f97316' }}
                      />
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                          setEditingItem(item);
                          setItemFormVisible(true);
                        }}
                      >
                        <Pencil size={18} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        ))}
      </ScrollView>

      <CategoryForm
        visible={categoryFormVisible}
        onClose={() => setCategoryFormVisible(false)}
        category={editingCategory}
      />

      <ItemForm
        visible={itemFormVisible}
        onClose={() => setItemFormVisible(false)}
        item={editingItem}
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  addButtonTextSecondary: {
    color: '#f97316',
    marginLeft: 4,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  categorySection: {
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  itemCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginTop: 8,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
});
