/**
 * Sikasem Root Layout
 * - Wraps app in QueryClientProvider + SafeAreaProvider
 * - Bootstraps auth session on mount
 * - Redirects unauthenticated users to /otp-verify
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth';
import { Colors } from '@/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading, bootstrap } = useAuthStore();

  useEffect(() => {
    bootstrap();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.g} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/otp-verify" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="otp-verify" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootLayoutNav />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.w,
  },
});
