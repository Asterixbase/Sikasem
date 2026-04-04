/**
 * Sikasem (main) Layout — Bottom Tab Navigation
 *
 * Visible tabs:
 *   1. Dash    (🏠) → dash
 *   2. Sale    (💰) → sale
 *   3. Scan    (⊙)  → scan   [center FAB]
 *   4. Credit  (💳) → credit-list
 *   5. More    (☰)  → settings
 *
 * All other screens in the group are registered with href: null so they
 * are reachable via router.push() but hidden from the tab bar.
 */
import { Tabs } from 'expo-router';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { Colors } from '@/constants';
import { useOfflineSync } from '@/hooks/useOfflineSync';

// ---------------------------------------------------------------------------
// Scan FAB — center tab button
// ---------------------------------------------------------------------------
function ScanFAB({ onPress }: BottomTabBarButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.fab}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Scan"
    >
      <Text style={styles.fabIcon}>⊙</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Tab icon helper — plain Text so no icon library needed
// ---------------------------------------------------------------------------
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
      {label}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Hidden screen config — reusable option set
// ---------------------------------------------------------------------------
const HIDDEN = { href: null } as const;

// ---------------------------------------------------------------------------
// Offline sync banner
// ---------------------------------------------------------------------------
function OfflineSyncBanner() {
  const { pendingCount, totalSynced, isSyncing } = useOfflineSync();

  // Show only when there's something to report
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
  wrap: {
    backgroundColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default function MainLayout() {
  return (
    <View style={{ flex: 1 }}>
    <OfflineSyncBanner />
    <Tabs
      initialRouteName="dash"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.g,
        tabBarInactiveTintColor: Colors.t2,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* ── Visible tabs ───────────────────────────────────────────────── */}

      <Tabs.Screen
        name="dash"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="🏠" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="sale"
        options={{
          title: 'Sales',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="💰" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarButton: (props) => <ScanFAB {...props} />,
        }}
      />

      <Tabs.Screen
        name="credit-list"
        options={{
          title: 'Credit',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="💳" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="☰" focused={focused} />
          ),
        }}
      />

      {/* ── Hidden screens (registered so expo-router can route to them) ─ */}

      <Tabs.Screen name="index"           options={HIDDEN} />
      <Tabs.Screen name="sold-today"      options={HIDDEN} />
      <Tabs.Screen name="low-stock"       options={HIDDEN} />
      <Tabs.Screen name="skus"            options={HIDDEN} />
      <Tabs.Screen name="scan-result"     options={HIDDEN} />
      <Tabs.Screen name="cat"             options={HIDDEN} />
      <Tabs.Screen name="bulk"            options={HIDDEN} />
      <Tabs.Screen name="bulk-result"     options={HIDDEN} />
      <Tabs.Screen name="sale-ok"         options={HIDDEN} />
      <Tabs.Screen name="daily-batch"     options={HIDDEN} />
      <Tabs.Screen name="search"          options={HIDDEN} />
      <Tabs.Screen name="credit-new"      options={HIDDEN} />
      <Tabs.Screen name="id-scan"         options={HIDDEN} />
      <Tabs.Screen name="credit-step2"    options={HIDDEN} />
      <Tabs.Screen name="credit-ok"       options={HIDDEN} />
      <Tabs.Screen name="whatsapp"        options={HIDDEN} />
      <Tabs.Screen name="credit-detail"   options={HIDDEN} />
      <Tabs.Screen name="collection-logs" options={HIDDEN} />
      <Tabs.Screen name="margins"         options={HIDDEN} />
      <Tabs.Screen name="sup"             options={HIDDEN} />
      <Tabs.Screen name="reorder"         options={HIDDEN} />
      <Tabs.Screen name="wa-order"        options={HIDDEN} />
      <Tabs.Screen name="analytics"       options={HIDDEN} />
      <Tabs.Screen name="retail-insights" options={HIDDEN} />
      <Tabs.Screen name="sales-report"    options={HIDDEN} />
      <Tabs.Screen name="price-history"   options={HIDDEN} />
      <Tabs.Screen name="tax"             options={HIDDEN} />
      <Tabs.Screen name="inv"             options={HIDDEN} />
      <Tabs.Screen name="inv-ext"         options={HIDDEN} />
      <Tabs.Screen name="inv-list"        options={HIDDEN} />
      <Tabs.Screen name="gra"             options={HIDDEN} />
      <Tabs.Screen name="inv-logs"        options={HIDDEN} />
      <Tabs.Screen name="inv-adjust"      options={HIDDEN} />
      <Tabs.Screen name="inv-audit"       options={HIDDEN} />
      <Tabs.Screen name="vault"           options={HIDDEN} />
      <Tabs.Screen name="momo-payout"     options={HIDDEN} />
      <Tabs.Screen name="payout-history"  options={HIDDEN} />
      <Tabs.Screen name="help"            options={HIDDEN} />
      <Tabs.Screen name="admin-system"    options={HIDDEN} />
      <Tabs.Screen name="system-logs"     options={HIDDEN} />
      <Tabs.Screen name="log-detail"      options={HIDDEN} />
      <Tabs.Screen name="security-audit"  options={HIDDEN} />
      <Tabs.Screen name="permissions"     options={HIDDEN} />
      <Tabs.Screen name="access-logs"     options={HIDDEN} />
    </Tabs>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },

  // Scan FAB
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.g,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 12 : 20,
    // Shadow — iOS
    shadowColor: Colors.g,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    // Shadow — Android
    elevation: 8,
  },
  fabIcon: {
    fontSize: 26,
    color: Colors.w,
    lineHeight: 30,
  },
});
