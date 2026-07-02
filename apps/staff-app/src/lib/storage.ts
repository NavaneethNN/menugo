import * as SecureStore from 'expo-secure-store';
import type { StaffRole } from '@restaurant/shared-types';

const AUTH_KEY = 'restaurant_auth';

export interface StoredAuth {
  token: string;
  staffId: string;
  name: string;
  role: StaffRole;
  kitchenId: string | null;
  restaurantId: string;
}

export async function saveAuth(payload: StoredAuth): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('[storage] Failed to save auth:', error);
  }
}

export async function loadAuth(): Promise<StoredAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch (error) {
    console.error('[storage] Failed to load auth:', error);
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_KEY);
  } catch (error) {
    console.error('[storage] Failed to clear auth:', error);
  }
}
