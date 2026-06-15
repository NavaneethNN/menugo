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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ChefHat } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';
import { StaffRole } from '@restaurant/shared-types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface StaffFormProps {
  visible: boolean;
  onClose: () => void;
  staff?: {
    id: string;
    name: string;
    role: StaffRole;
    kitchenId?: string | null;
    isActive: boolean;
  } | null;
}

interface Kitchen {
  id: string;
  name: string;
}

const ROLES: { value: StaffRole; label: string; color: string }[] = [
  { value: 'ADMIN', label: 'Admin', color: '#7c3aed' },
  { value: 'KITCHEN', label: 'Kitchen', color: '#f97316' },
  { value: 'WAITER', label: 'Waiter', color: '#22c55e' },
  { value: 'CASHIER', label: 'Cashier', color: '#3b82f6' },
];

async function fetchKitchens(token: string): Promise<Kitchen[]> {
  const res = await fetch(`${API_URL}/api/admin/kitchens`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch kitchens');
  return res.json();
}

async function createStaff(token: string, data: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/admin/staff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create staff');
  return res.json();
}

async function updateStaff(token: string, id: string, data: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/admin/staff/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update staff');
  return res.json();
}

export default function StaffForm({ visible, onClose, staff }: StaffFormProps) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const [name, setName] = useState(staff?.name ?? '');
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'WAITER');
  const [pin, setPin] = useState('');
  const [kitchenId, setKitchenId] = useState<string>(staff?.kitchenId ?? '');

  const kitchensQuery = useQuery({
    queryKey: ['admin-kitchens'],
    queryFn: () => fetchKitchens(token!),
    enabled: visible && !!token,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const data: Record<string, unknown> = {
        name: name.trim(),
        role,
        isActive: true,
      };
      if (pin.length >= 4) {
        data.pin = pin;
      }
      if (role === 'KITCHEN' && kitchenId) {
        data.kitchenId = kitchenId;
      }
      if (staff) {
        return updateStaff(token!, staff.id, data);
      }
      return createStaff(token!, { ...data, pin: pin || '0000' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      onClose();
    },
  });

  const isValid = name.trim().length > 0 && (!staff || pin.length === 0 || (pin.length >= 4 && pin.length <= 10));

  const needsKitchen = role === 'KITCHEN';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{staff ? 'Edit Staff' : 'New Staff'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Staff name" />

            <Text style={styles.label}>Role *</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleOption, role === r.value && { backgroundColor: r.color, borderColor: r.color }]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={[styles.roleOptionText, role === r.value && { color: '#fff' }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {needsKitchen && (
              <>
                <Text style={styles.label}>Kitchen Assignment *</Text>
                <View style={styles.kitchenGrid}>
                  {kitchensQuery.data?.map((kitchen) => (
                    <TouchableOpacity
                      key={kitchen.id}
                      style={[styles.kitchenOption, kitchenId === kitchen.id && styles.kitchenOptionSelected]}
                      onPress={() => setKitchenId(kitchen.id)}
                    >
                      <ChefHat size={16} color={kitchenId === kitchen.id ? '#f97316' : '#6b7280'} />
                      <Text style={[styles.kitchenText, kitchenId === kitchen.id && styles.kitchenTextSelected]}>
                        {kitchen.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>{staff ? 'New PIN (optional)' : 'PIN *'}</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="4-10 digits"
              keyboardType="number-pad"
              maxLength={10}
              secureTextEntry
            />

            {mutation.isError && <Text style={styles.error}>Failed to save staff</Text>}

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
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  kitchenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  kitchenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  kitchenOptionSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  kitchenText: {
    fontSize: 14,
    color: '#374151',
  },
  kitchenTextSelected: {
    color: '#f97316',
    fontWeight: '500',
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
