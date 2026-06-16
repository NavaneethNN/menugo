import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, User, ChefHat, UserCheck, UserCog, Briefcase } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';
import { StaffRole } from '@restaurant/shared-types';
import StaffForm from './staff-form';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  kitchen?: { id: string; name: string } | null;
}

const roleConfig: Record<StaffRole, { icon: typeof User; color: string; label: string }> = {
  ADMIN: { icon: UserCog, color: '#7c3aed', label: 'Admin' },
  KITCHEN: { icon: ChefHat, color: '#f97316', label: 'Kitchen' },
  WAITER: { icon: UserCheck, color: '#22c55e', label: 'Waiter' },
  CASHIER: { icon: Briefcase, color: '#3b82f6', label: 'Cashier' },
};

async function fetchStaff(token: string): Promise<Staff[]> {
  const res = await fetch(`${API_URL}/api/admin/staff`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch staff');
  return res.json();
}

async function toggleStaffActive(token: string, id: string, isActive: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/staff/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throw new Error('Failed to update staff');
}

export default function StaffScreen() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const staffQuery = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => fetchStaff(token!),
    enabled: !!token,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleStaffActive(token!, id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    },
  });

  const handleAdd = () => {
    setEditingStaff(null);
    setFormVisible(true);
  };

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setFormVisible(true);
  };

  const renderStaff = ({ item }: { item: Staff }) => {
    const config = roleConfig[item.role];
    const RoleIcon = config.icon;

    return (
      <TouchableOpacity style={styles.staffCard} onPress={() => handleEdit(item)}>
        <View style={[styles.avatar, { backgroundColor: config.color + '20' }]}>
          <RoleIcon size={24} color={config.color} />
        </View>

        <View style={styles.staffInfo}>
          <Text style={styles.staffName}>{item.name}</Text>
          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, { backgroundColor: config.color + '20' }]}>
              <Text style={[styles.roleText, { color: config.color }]}>{config.label}</Text>
            </View>
            {item.kitchen && (
              <Text style={styles.kitchenText}>• {item.kitchen.name}</Text>
            )}
          </View>
        </View>

        <View style={styles.activeToggle}>
          <Switch
            value={item.isActive}
            onValueChange={(value) => toggleMutation.mutate({ id: item.id, isActive: value })}
            trackColor={{ false: '#d1d5db', true: '#22c55e' }}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (staffQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Staff</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={staffQuery.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderStaff}
      />

      <StaffForm
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        staff={editingStaff}
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
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  kitchenText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  activeToggle: {
    marginLeft: 8,
  },
});
