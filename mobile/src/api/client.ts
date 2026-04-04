/**
 * Sikasem API Client
 * - Axios instance with base URL + default headers
 * - JWT Bearer token injected from SecureStore on every request
 * - Automatic token refresh on 401 (single in-flight refresh, queue retries)
 * - Clears tokens and redirects to OTP screen on unrecoverable auth failure
 * - Never logs tokens; never stores credentials in plain AsyncStorage
 */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Config ────────────────────────────────────────────────────────────────
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://sikasem-api.fly.dev/v1';
const REQUEST_TIMEOUT_MS = 30_000;

// ── SecureStore keys ──────────────────────────────────────────────────────
export const STORAGE = {
  ACCESS_TOKEN:  'sikasem_access_token',
  REFRESH_TOKEN: 'sikasem_refresh_token',
  SHOP_ID:       'sikasem_shop_id',
  USER_ID:       'sikasem_user_id',
} as const;

// ── Token helpers ─────────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE.ACCESS_TOKEN);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORAGE.ACCESS_TOKEN,  access),
    SecureStore.setItemAsync(STORAGE.REFRESH_TOKEN, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORAGE.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(STORAGE.SHOP_ID),
    SecureStore.deleteItemAsync(STORAGE.USER_ID),
  ]);
}

// ── Axios instance ────────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    'X-Client':     'sikasem-mobile/1.3.0',
  },
});

// ── Request interceptor — inject Bearer token ────────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ── Token refresh machinery ───────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

/** Called when refresh succeeds — drain queued requests with new token */
function _drainQueue(token: string): void {
  _refreshQueue.forEach(cb => cb(token));
  _refreshQueue = [];
}

/** Called when refresh fails — drain queue with null to reject all */
function _rejectQueue(): void {
  _refreshQueue.forEach(cb => cb(null));
  _refreshQueue = [];
}

// Callback registered by the auth store so we can navigate on logout
let _onLogout: (() => void) | null = null;
export function registerLogoutHandler(fn: () => void): void {
  _onLogout = fn;
}

async function _doRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(STORAGE.REFRESH_TOKEN);
  if (!refreshToken) return null;

  try {
    // Bypass the main api instance to avoid interceptor loop
    const res = await axios.post<{ access_token: string; refresh_token: string }>(
      `${API_BASE}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const { access_token, refresh_token } = res.data;
    await setTokens(access_token, refresh_token);
    return access_token;
  } catch {
    return null;
  }
}

// ── Response interceptor — handle 401 + refresh ──────────────────────────
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (_isRefreshing) {
        // Queue this request until the in-flight refresh resolves
        return new Promise((resolve, reject) => {
          _refreshQueue.push((token) => {
            if (!token) return reject(error);
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      _isRefreshing = true;
      const newToken = await _doRefresh();
      _isRefreshing = false;

      if (!newToken) {
        _rejectQueue();
        await clearTokens();
        _onLogout?.();
        return Promise.reject(error);
      }

      _drainQueue(newToken);
      if (originalRequest.headers) {
        (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      }
      return api(originalRequest);
    }

    return Promise.reject(error);
  },
);

// ── Error normaliser ──────────────────────────────────────────────────────
export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}

export function normaliseError(err: unknown): ApiError {
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as Record<string, unknown> | undefined;
    return {
      status: err.response.status,
      message: (data?.detail as string) ?? err.message,
      detail: data,
    };
  }
  return { status: 0, message: 'Network error. Please check your connection.' };
}
