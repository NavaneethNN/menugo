import { create } from 'zustand';
import type { StaffRole } from '@restaurant/shared-types';

import { saveAuth, clearAuth as clearStoredAuth } from '@/lib/storage';

interface AuthState {
  token: string | null;
  staffId: string | null;
  name: string | null;
  role: StaffRole | null;
  kitchenId: string | null;
  restaurantId: string | null;
  setAuth: (payload: {
    token: string;
    staffId: string;
    name: string;
    role: StaffRole;
    kitchenId: string | null;
    restaurantId: string;
  }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  staffId: null,
  name: null,
  role: null,
  kitchenId: null,
  restaurantId: null,
  setAuth: (payload) => {
    saveAuth(payload);
    set({
      token: payload.token,
      staffId: payload.staffId,
      name: payload.name,
      role: payload.role,
      kitchenId: payload.kitchenId,
      restaurantId: payload.restaurantId,
    });
  },
  clearAuth: () => {
    clearStoredAuth();
    set({
      token: null,
      staffId: null,
      name: null,
      role: null,
      kitchenId: null,
      restaurantId: null,
    });
  },
}));
