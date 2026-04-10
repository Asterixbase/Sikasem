/**
 * (main) Stack layout
 *
 * The 5 tab screens live in (tabs)/ and are rendered by the Tabs navigator there.
 * Every drill-down screen (sold-today, low-stock, credit-detail, etc.) is pushed
 * onto THIS Stack, so router.back() always works correctly.
 */
import { Stack } from 'expo-router';

export default function MainLayout() {

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
