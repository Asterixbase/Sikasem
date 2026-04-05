import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { SikasemLogo, MetricTile, LoadingState, ErrorState } from '@/components';
import { useThemePalette } from '@/store/theme';

const QUICK_ACTIONS = [
  { icon: '📷', label: 'Scan',   route: '/(main)/scan' },
  { icon: '💰', label: 'Sell',   route: '/(main)/sale' },
  { icon: '🧾', label: 'Tax',    route: '/(main)/tax' },
  { icon: '💳', label: 'Credit', route: '/(main)/credit-list' },
  { icon: '📊', label: 'Reports',route: '/(main)/analytics' },
  { icon: '🏦', label: 'Treasury', route: '/(main)/treasury' },
];

export default function DashScreen() {
  const theme = useThemePalette();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading dashboard…" />;
  if (error || !data) return <ErrorState message="Could not load dashboard" onRetry={refetch} />;

  const d = data;
  const totalGHS   = (d.today_revenue_pesawas / 100).toFixed(2);
  const cashGHS    = ((d.today_cash_pesawas   ?? 0) / 100).toFixed(2);
  const momoGHS    = ((d.today_momo_pesawas   ?? 0) / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.safe}>
      {/* App bar */}
      <View style={styles.appBar}>
        <SikasemLogo size="sm" layout="row" showTagline={false} />
        <View style={styles.appBarRight}>
          <Pressable
            onPress={() => router.push('/(main)/(tabs)/settings' as any)}
            style={styles.cogBtn}
            hitSlop={8}
          >
            <Text style={styles.cogIcon}>⚙️</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(main)/(tabs)/settings' as any)}
            style={[styles.avatar, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.avatarText}>
              {(d.shop_name ?? 'S')[0].toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Revenue hero — full brand card */}
        <View style={[styles.hero, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroLabel}>Today's revenue</Text>
          <Text style={styles.heroAmount}>GHS {totalGHS}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroSub}>Cash GHS {cashGHS}</Text>
            <Text style={styles.heroDot}> · </Text>
            <Text style={styles.heroSub}>MoMo GHS {momoGHS}</Text>
          </View>
          {d.revenue_change_pct != null && (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {d.revenue_change_pct >= 0 ? '▲' : '▼'} {Math.abs(d.revenue_change_pct).toFixed(0)}% vs yesterday
              </Text>
            </View>
          )}
        </View>

        {/* Metric tiles 2×2 */}
        <View style={styles.tilesGrid}>
          <MetricTile
            label="Items sold today"
            value={String(d.sold_today_count)}
            change={d.sold_change != null ? `▲ ${d.sold_change} vs yesterday` : undefined}
            positive
            onPress={() => router.push('/(main)/sold-today')}
          />
          <MetricTile
            label="Low stock alerts"
            value={String(d.low_stock_count)}
            change="Tap to review"
            positive={false}
            onPress={() => router.push('/(main)/low-stock')}
          />
          <MetricTile
            label="Avg profit margin"
            value={`${d.avg_margin_pct.toFixed(1)}%`}
            change="Tap for details"
            positive
            onPress={() => router.push('/(main)/margins')}
          />
          <MetricTile
            label="Total SKUs"
            value={String(d.total_skus)}
            change={d.sku_change != null ? `+${d.sku_change} this week` : undefined}
            onPress={() => router.push('/(main)/skus?id=all')}
          />
        </View>

        {/* Alerts with severity dot */}
        {d.alerts?.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.alertsHeader}>
              <Text style={styles.alertsTitle}>Urgent alerts</Text>
              <Pressable onPress={() => router.push('/(main)/low-stock')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            {d.alerts.map((a: any, i: number) => (
              <View key={i} style={[
                styles.alertCard,
                a.urgency === 'critical' ? styles.alertCardRed
                  : (a.urgency === 'warning' || a.urgency === 'high') ? styles.alertCardAmber
                  : styles.alertCardGreen,
              ]}>
                <View style={[
                  styles.alertDot,
                  { backgroundColor: a.urgency === 'critical' ? Colors.rt
                      : (a.urgency === 'warning' || a.urgency === 'high') ? Colors.at : Colors.g2 },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertText}>{a.message}</Text>
                  {a.detail ? <Text style={styles.alertSub}>{a.detail}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick actions — 3-column grid */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsTitle}>Quick actions</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map(a => (
              <Pressable
                key={a.route}
                style={styles.actionBtn}
                onPress={() => router.push(a.route as any)}
              >
                <Text style={styles.actionIcon}>{a.icon}</Text>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gy },

  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.s4, paddingVertical: 10,
    backgroundColor: Colors.w,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  appBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2 },
  cogBtn: { padding: 4 },
  cogIcon: { fontSize: 20 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.g, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...Typography.titleSM, color: Colors.w },

  // Hero card
  hero: {
    backgroundColor: Colors.g,
    margin: Spacing.s4,
    borderRadius: Radius.xl,
    padding: Spacing.s6,
  },
  heroLabel: { ...Typography.label, color: 'rgba(255,255,255,0.75)' },
  heroAmount: { fontSize: 36, fontWeight: '700', color: Colors.w, marginTop: 4, lineHeight: 44 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  heroSub: { ...Typography.bodySM, color: 'rgba(255,255,255,0.75)' },
  heroDot: { ...Typography.bodySM, color: 'rgba(255,255,255,0.5)' },
  heroBadge: {
    marginTop: 10, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  heroBadgeText: { ...Typography.badge, color: Colors.w },

  // Metric tiles
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.s4, marginBottom: Spacing.s2,
  },

  // Alerts section
  alertsSection: { paddingHorizontal: Spacing.s4, marginBottom: Spacing.s2 },
  alertsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.s2 },
  alertsTitle: { ...Typography.titleSM, color: Colors.t },
  seeAll: { ...Typography.bodyMD, color: Colors.g, fontWeight: '600' },
  alertCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.s2,
    borderRadius: Radius.md, padding: Spacing.s3, marginBottom: Spacing.s2,
    borderLeftWidth: 3,
  },
  alertCardRed:   { backgroundColor: Colors.r,  borderLeftColor: Colors.rt },
  alertCardAmber: { backgroundColor: Colors.a,  borderLeftColor: Colors.at },
  alertCardGreen: { backgroundColor: Colors.gl, borderLeftColor: Colors.g2 },
  alertDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  alertText: { ...Typography.bodyMD, color: Colors.t, fontWeight: '600' },
  alertSub:  { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },

  // Quick actions
  actionsSection: { paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s8 },
  actionsTitle: { ...Typography.titleSM, color: Colors.t, marginBottom: Spacing.s3 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: '30%', backgroundColor: Colors.w, borderRadius: Radius.lg,
    paddingVertical: Spacing.s4, alignItems: 'center', ...Shadows.card,
  },
  actionIcon:  { fontSize: 22, marginBottom: 5 },
  actionLabel: { ...Typography.badge, color: Colors.t, fontWeight: '600' },
});
