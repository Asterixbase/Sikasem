import React, { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { useAuthStore } from '@/store/auth';
import { useTierStore } from '@/store/tier';
import { API_BASE, notificationsApi } from '@/api';

// Keep Fly.io machine warm — ping every 4 minutes
const _keepAlive = setInterval(() => {
  fetch(`${API_BASE.replace('/v1', '')}/health`).catch(() => {});
}, 4 * 60 * 1000);

// ── Error boundary — shows the error instead of crashing ─────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; componentStack: string | null }
> {
  state = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      const msg = String((this.state.error as Error).message);
      const stack = String((this.state.error as Error).stack ?? '').slice(0, 400);
      const comp = String(this.state.componentStack ?? '').slice(0, 400);
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#c00', marginBottom: 8 }}>
            App Error
          </Text>
          <Text style={{ fontSize: 12, color: '#333', marginBottom: 6 }}>MSG: {msg}</Text>
          <Text style={{ fontSize: 10, color: '#555', fontFamily: 'Courier New', marginBottom: 6 }}>
            STACK:{'\n'}{stack}
          </Text>
          <Text style={{ fontSize: 10, color: '#555', fontFamily: 'Courier New' }}>
            COMP:{'\n'}{comp}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── Query client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

// ── Push token registration ───────────────────────────────────────────────────
async function registerPushToken() {
  if (!Device.isDevice) return; // skip simulators
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  try {
    await notificationsApi.registerToken(token);
  } catch (_) {
    // non-blocking — push is best-effort
  }
}

// ── Root navigator with auth guard ────────────────────────────────────────────
function RootLayoutNav() {
  const { isLoading, isAuthenticated, bootstrap } = useAuthStore();
  const hasChosen = useTierStore(s => s.hasChosen);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    bootstrap();
  }, []);

  // Register push token once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken().catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inMain    = segments[0] === '(main)';
    const inOtp     = segments[0] === 'otp-verify';
    const inLanding = segments[0] === 'landing';

    if (isAuthenticated && !inMain) {
      router.replace('/(main)/dash');
    } else if (!isAuthenticated && !inOtp && !inLanding) {
      // First-time users see the landing page; returning users go straight to OTP
      router.replace(hasChosen ? '/otp-verify' : '/landing');
    }
  }, [isLoading, isAuthenticated, hasChosen]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index"      options={{ headerShown: false }} />
      <Stack.Screen name="landing"    options={{ headerShown: false }} />
      <Stack.Screen name="(main)"     options={{ headerShown: false }} />
      <Stack.Screen name="otp-verify" options={{ headerShown: false }} />
    </Stack>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <RootLayoutNav />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
