/**
 * Sikasem Auth Store — Zustand
 * Persists: nothing in memory that's sensitive.
 * JWT lives only in expo-secure-store (never in AsyncStorage or zustand persist).
 * registerLogoutHandler wires the API client 401 handler back to this store.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import {
  authApi,
  getAccessToken,
  clearTokens,
  registerLogoutHandler,
  STORAGE,
} from '@/api';

export type ShopRole = 'owner' | 'manager' | 'staff';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  shopId: string | null;
  phone: string | null;
  role: ShopRole;
  isLoading: boolean;
  error: string | null;

  // Actions
  bootstrap: () => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

/** Decode the role claim from a JWT without verifying the signature (signature is verified server-side). */
function decodeJwtRole(token: string): ShopRole {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const role = decoded?.role;
    if (role === 'owner' || role === 'manager' || role === 'staff') return role;
  } catch {}
  return 'staff';
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire the API client 401-logout callback to this store's logout action
  registerLogoutHandler(() => get().logout());

  return {
    isAuthenticated: false,
    userId: null,
    shopId: null,
    phone: null,
    role: 'owner',    // default — overwritten on bootstrap/login
    isLoading: true,  // true on startup — stays until bootstrap() resolves
    error: null,

    /** Called on app start to restore session from SecureStore */
    bootstrap: async () => {
      set({ isLoading: true });
      try {
        const token = await getAccessToken();
        if (!token) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }
        const userId = await SecureStore.getItemAsync(STORAGE.USER_ID);
        const shopId  = await SecureStore.getItemAsync(STORAGE.SHOP_ID);
        const role    = decodeJwtRole(token);
        set({ isAuthenticated: true, userId, shopId, role, isLoading: false });
      } catch {
        set({ isAuthenticated: false, isLoading: false });
      }
    },

    sendOtp: async (phone: string) => {
      set({ isLoading: true, error: null });
      try {
        await authApi.sendOtp({ phone });
        set({ phone, isLoading: false });
      } catch (err: unknown) {
        const msg = extractMessage(err);
        set({ isLoading: false, error: msg });
        throw err;
      }
    },

    verifyOtp: async (phone: string, code: string) => {
      set({ isLoading: true, error: null });
      try {
        const data = await authApi.verifyOtp({ phone, code });
        // JWT stored in SecureStore by authApi.verifyOtp; decode role from it
        const token = await getAccessToken();
        const role = token ? decodeJwtRole(token) : 'owner';
        set({ isAuthenticated: true, phone, role, isLoading: false });
        router.replace('/(main)/dash');
      } catch (err: unknown) {
        const msg = extractMessage(err);
        set({ isLoading: false, error: msg });
        throw err;
      }
    },

    logout: async () => {
      await clearTokens();
      set({
        isAuthenticated: false,
        userId: null,
        shopId: null,
        phone: null,
        role: 'owner',
        error: null,
      });
      router.replace('/otp-verify');
    },

    clearError: () => set({ error: null }),
  };
});

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { detail?: string } } }).response?.data;
    return data?.detail ?? 'Something went wrong';
  }
  return 'Network error. Please try again.';
}
