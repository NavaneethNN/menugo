import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, ChefHat, UserCheck, Check } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type WorkflowMode = 'ASSISTED_DINING' | 'MANAGED_DINING' | 'SELF_COLLECTION';

interface Restaurant {
  id: string;
  name: string;
  workflowMode: WorkflowMode;
}

const MODES: { value: WorkflowMode; label: string; description: string; icon: typeof Users }[] = [
  {
    value: 'ASSISTED_DINING',
    label: 'Assisted Dining',
    description: 'Waiter takes orders and relays to kitchen manually',
    icon: UserCheck,
  },
  {
    value: 'MANAGED_DINING',
    label: 'Managed Dining',
    description: 'Customers order directly, staff deliver when ready',
    icon: Users,
  },
  {
    value: 'SELF_COLLECTION',
    label: 'Self Collection',
    description: 'Customers order and collect from kitchen counter',
    icon: ChefHat,
  },
];

async function fetchRestaurant(token: string): Promise<Restaurant> {
  const res = await fetch(`${API_URL}/api/restaurants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch restaurant');
  const data = await res.json();
  return data[0];
}

async function updateWorkflowMode(token: string, mode: WorkflowMode): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/restaurant/workflow-mode`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflowMode: mode }),
  });
  if (!res.ok) throw new Error('Failed to update workflow mode');
}

export default function SettingsScreen() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [selectedMode, setSelectedMode] = useState<WorkflowMode>('MANAGED_DINING');

  const restaurantQuery = useQuery({
    queryKey: ['admin-restaurant'],
    queryFn: () => fetchRestaurant(token!),
    enabled: !!token,
  });

  useEffect(() => {
    if (restaurantQuery.data) {
      setSelectedMode(restaurantQuery.data.workflowMode);
    }
  }, [restaurantQuery.data]);

  const mutation = useMutation({
    mutationFn: (mode: WorkflowMode) => updateWorkflowMode(token!, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant'] });
    },
  });

  const handleSave = () => {
    mutation.mutate(selectedMode);
  };

  const currentMode = restaurantQuery.data?.workflowMode;
  const hasChanges = currentMode !== selectedMode;

  if (restaurantQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restaurant Info</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{restaurantQuery.data?.name}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workflow Mode</Text>
        <Text style={styles.sectionSubtitle}>Current: {MODES.find((m) => m.value === currentMode)?.label}</Text>

        <View style={styles.modesContainer}>
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.value;

            return (
              <TouchableOpacity
                key={mode.value}
                style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                onPress={() => setSelectedMode(mode.value)}
              >
                <View style={styles.modeHeader}>
                  <View style={[styles.modeIcon, isSelected && styles.modeIconSelected]}>
                    <Icon size={24} color={isSelected ? '#f97316' : '#6b7280'} />
                  </View>
                  {isSelected && <Check size={20} color="#f97316" />}
                </View>
                <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>{mode.label}</Text>
                <Text style={styles.modeDescription}>{mode.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {hasChanges && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, mutation.isPending && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  modesContainer: {
    gap: 12,
  },
  modeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeIconSelected: {
    backgroundColor: '#fff',
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modeLabelSelected: {
    color: '#f97316',
  },
  modeDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
