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

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  shopId: string | null;
  phone: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  bootstrap: () => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire the API client 401-logout callback to this store's logout action
  registerLogoutHandler(() => get().logout());

  return {
    isAuthenticated: false,
    userId: null,
    shopId: null,
    phone: null,
    isLoading: true,   // true on startup — stays until bootstrap() resolves
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
        set({ isAuthenticated: true, userId, shopId, isLoading: false });
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
        // JWT already stored in SecureStore by authApi.verifyOtp
        set({ isAuthenticated: true, phone, isLoading: false });
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
