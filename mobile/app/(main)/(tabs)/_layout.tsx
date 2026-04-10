/**
 * (tabs) layout — Bottom Tab Navigation
 * Only the 5 visible tabs are registered here.
 * All drill-down screens live in the parent (main) Stack and get proper back navigation.
 */
import { Tabs } from 'expo-router';
import { TouchableOpacity, Text, View, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { Colors } from '@/constants';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useThemePalette } from '@/store/theme';

function ScanFAB({ onPress }: BottomTabBarButtonProps) {
  const theme = useThemePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Scan"
    >
      <Text style={styles.fabIcon}>⊙</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{label}</Text>
  );
}

function OfflineSyncBanner() {
  const { pendingCount, isSyncing } = useOfflineSync();
  if (pendingCount === 0 && !isSyncing) return null;
  const msg = isSyncing
    ? `Syncing ${pendingCount} offline sale${pendingCount !== 1 ? 's' : ''}…`
    : `${pendingCount} sale${pendingCount !== 1 ? 's' : ''} queued offline · will sync on reconnect`;
  return (
    <View style={bannerStyles.wrap}>
      <Text style={bannerStyles.text}>{msg}</Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: { backgroundColor: Colors.at, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  text: { color: Colors.w, fontSize: 12, fontWeight: '600' },
});

export default function TabsLayout() {
  const theme = useThemePalette();
  return (
    <View style={{ flex: 1 }}>
      <OfflineSyncBanner />
      <Tabs
        initialRouteName="dash"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: Colors.t2,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="dash"
          options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }}
        />
        <Tabs.Screen
          name="sale"
          options={{ title: 'Sales', tabBarIcon: ({ focused }) => <TabIcon label="💰" focused={focused} /> }}
        />
        <Tabs.Screen
          name="scan"
          options={{ title: 'Scan', tabBarButton: (props) => <ScanFAB {...props} /> }}
        />
        <Tabs.Screen
          name="credit-list"
          options={{ title: 'Credit', tabBarIcon: ({ focused }) => <TabIcon label="💳" focused={focused} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon label="⚙️" focused={focused} /> }}
        />
      </Tabs>
    </View>
  );
}

const TAB_BAR_HEIGHT = 60;
const FAB_SIZE = 60;

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.w,
    borderTopWidth: 1,
    borderTopColor: Colors.gy2,
    height: TAB_BAR_HEIGHT + (Platform.OS === 'ios' ? 20 : 0),
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  tabIcon: { fontSize: 20, opacity: 0.6 },
  tabIconActive: { opacity: 1 },
  fab: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: 14,
    backgroundColor: Colors.g, justifyContent: 'center', alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 16 : 18,
    shadowColor: Colors.g, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { fontSize: 26, color: Colors.w, lineHeight: 30 },
});
