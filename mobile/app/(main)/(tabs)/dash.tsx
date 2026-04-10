import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { SikasemLogo, MetricTile, LoadingState, ErrorState } from '@/components';
import { useThemePalette } from '@/store/theme';
import { useTierStore, type TierFeature } from '@/store/tier';
import { fmtTime, fmtDate } from '@/utils/date';

// All quick actions — each tagged with the tier feature required (null = always visible)
const ALL_QUICK_ACTIONS: Array<{ icon: string; label: string; route: string; feature: TierFeature | null }> = [
  { icon: '📷', label: 'Scan',      route: '/(main)/scan',         feature: null },
  { icon: '💰', label: 'Sell',      route: '/(main)/sale',         feature: null },
  { icon: '💳', label: 'Credit',    route: '/(main)/credit-list',  feature: null },
  { icon: '🤖', label: 'Ask Sika',  route: '/(main)/ai-chat',      feature: null },
  { icon: '📊', label: 'Analytics', route: '/(main)/analytics',    feature: 'reports' },
  { icon: '📋', label: 'Reports',   route: '/(main)/daily-reports',feature: 'daily_reports' },
  { icon: '🔁', label: 'Reorder',   route: '/(main)/reorder',      feature: 'reorder' },
  { icon: '📄', label: 'OCR Scan',  route: '/(main)/bulk',         feature: 'ocr' },
  { icon: '🏦', label: 'Treasury',  route: '/(main)/treasury',     feature: 'treasury' },
  { icon: '🧾', label: 'Tax',       route: '/(main)/tax',          feature: 'tax' },
  { icon: '🔍', label: 'Search',    route: '/(main)/search',       feature: 'search' },
];

const PAYMENT_ICONS: Record<string, string> = {
  cash:   '💵',
  momo:   '📱',
  credit: '💳',
};

export default function DashScreen() {
  const theme = useThemePalette();
  const { can, logoVariant } = useTierStore();

  // Filter quick actions based on the active tier (superuser override applies via can())
  const quickActions = ALL_QUICK_ACTIONS.filter(a => a.feature === null || can(a.feature));
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then(r => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingState message="Loading dashboard…" />;
  if (error || !data) return <ErrorState message="Could not load dashboard" onRetry={refetch} />;

  const d = data;
  const totalGHS = (d.today_revenue_pesawas / 100).toFixed(2);
  const cashGHS  = ((d.today_cash_pesawas  ?? 0) / 100).toFixed(2);
  const momoGHS  = ((d.today_momo_pesawas  ?? 0) / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.safe}>
      {/* App bar */}
      <View style={styles.appBar}>
        <SikasemLogo size="sm" layout="row" showTagline={false} variant={logoVariant} color={theme.primary} />
        <View style={styles.appBarRight}>
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
        {/* Revenue hero */}
        <View style={[styles.hero, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroLabel}>Today's revenue</Text>
          <Text style={styles.heroAmount}>GHS {totalGHS}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroSub}>💵 Cash GHS {cashGHS}</Text>
            <Text style={styles.heroDot}> · </Text>
            <Text style={styles.heroSub}>📱 MoMo GHS {momoGHS}</Text>
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
            value={String(d.sold_today_count ?? 0)}
            change={d.sold_change != null
              ? (d.sold_change >= 0 ? `▲ ${d.sold_change} vs yesterday` : `▼ ${Math.abs(d.sold_change)} vs yesterday`)
              : 'Tap to see breakdown'}
            positive={d.sold_change == null || d.sold_change >= 0}
            onPress={() => router.push('/(main)/sold-today')}
          />
          <MetricTile
            label="Low stock alerts"
            value={String(d.low_stock_count ?? 0)}
            change={d.low_stock_count > 0 ? 'Tap to review' : 'All stocked up'}
            positive={d.low_stock_count === 0}
            onPress={() => router.push('/(main)/low-stock')}
          />
          <MetricTile
            label="Avg profit margin"
            value={`${(d.avg_margin_pct ?? 0).toFixed(1)}%`}
            change="Tap for details"
            positive={(d.avg_margin_pct ?? 0) >= 20}
            onPress={() => router.push('/(main)/margins')}
          />
          <MetricTile
            label="Total SKUs"
            value={String(d.total_skus ?? 0)}
            change={d.sku_change != null && d.sku_change > 0
              ? `+${d.sku_change} this week`
              : 'Tap to manage'}
            onPress={() => router.push('/(main)/skus?id=all')}
          />
        </View>

        {/* Top product today */}
        {d.top_product_today != null && (
          <View style={styles.topProductSection}>
            <Text style={styles.sectionTitle}>Top seller today</Text>
            <Pressable
              style={[styles.topProductCard, { borderLeftColor: theme.primary }]}
              onPress={() => router.push('/(main)/sold-today')}
            >
              <Text style={styles.topProductEmoji}>{d.top_product_today.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.topProductName}>{d.top_product_today.name}</Text>
                <Text style={styles.topProductSub}>
                  {d.top_product_today.units} units · GHS {(d.top_product_today.revenue_pesawas / 100).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.topProductChevron}>›</Text>
            </Pressable>
          </View>
        )}

        {/* Alerts */}
        {d.alerts?.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Urgent alerts</Text>
              <Pressable onPress={() => router.push('/(main)/low-stock')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
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

        {/* Recent activity feed */}
        {d.recent_sales?.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent sales</Text>
              <Pressable onPress={() => router.push('/(main)/search' as any)}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>View all</Text>
              </Pressable>
            </View>
            {d.recent_sales.map((s: any) => (
              <View key={s.id} style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Text style={styles.activityIcon}>
                    {PAYMENT_ICONS[s.payment_method] ?? '💰'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>Sale #{s.reference}</Text>
                  <Text style={styles.activitySub}>{fmtDate(s.created_at)} · {fmtTime(s.created_at)}</Text>
                </View>
                <Text style={styles.activityAmt}>
                  GHS {(s.amount_pesawas / 100).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick actions — tier-gated */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map(a => (
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
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...Typography.titleSM, color: Colors.w },

  // Hero card
  hero: {
    margin: Spacing.s4,
    borderRadius: Radius.xl,
    padding: Spacing.s6,
  },
  heroLabel:  { ...Typography.label, color: 'rgba(255,255,255,0.75)' },
  heroAmount: { fontSize: 36, fontWeight: '700', color: Colors.w, marginTop: 4, lineHeight: 44 },
  heroRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 4 },
  heroSub:    { ...Typography.bodySM, color: 'rgba(255,255,255,0.8)' },
  heroDot:    { ...Typography.bodySM, color: 'rgba(255,255,255,0.4)' },
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

  // Shared section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.s2,
  },
  sectionTitle: { ...Typography.titleSM, color: Colors.t },
  seeAll: { ...Typography.bodyMD, fontWeight: '600' },

  // Top product
  topProductSection: { paddingHorizontal: Spacing.s4, marginBottom: Spacing.s4 },
  topProductCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s4, ...Shadows.card,
    borderLeftWidth: 4,
  },
  topProductEmoji: { fontSize: 28 },
  topProductName:  { ...Typography.titleSM, color: Colors.t },
  topProductSub:   { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  topProductChevron: { fontSize: 20, color: Colors.t2 },

  // Alerts section
  alertsSection: { paddingHorizontal: Spacing.s4, marginBottom: Spacing.s4 },
  alertCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.s2,
    borderRadius: Radius.md, padding: Spacing.s3, marginBottom: Spacing.s2,
    borderLeftWidth: 3,
  },
  alertCardRed:   { backgroundColor: Colors.r,  borderLeftColor: Colors.rt },
  alertCardAmber: { backgroundColor: Colors.a,  borderLeftColor: Colors.at },
  alertCardGreen: { backgroundColor: Colors.gl, borderLeftColor: Colors.g2 },
  alertDot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  alertText: { ...Typography.bodyMD, color: Colors.t, fontWeight: '600' },
  alertSub:  { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },

  // Recent activity
  recentSection: {
    paddingHorizontal: Spacing.s4, marginBottom: Spacing.s4,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    backgroundColor: Colors.w,
    paddingVertical: Spacing.s3, paddingHorizontal: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  activityIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
  },
  activityIcon:  { fontSize: 18 },
  activityTitle: { ...Typography.bodyMD, color: Colors.t, fontWeight: '600' },
  activitySub:   { ...Typography.bodySM, color: Colors.t2 },
  activityAmt:   { ...Typography.bodyMD, color: Colors.t, fontWeight: '700' },

  // Quick actions
  actionsSection: { paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Spacing.s3 },
  actionBtn: {
    width: '30%', backgroundColor: Colors.w, borderRadius: Radius.lg,
    paddingVertical: Spacing.s4, alignItems: 'center', ...Shadows.card,
  },
  actionIcon:  { fontSize: 22, marginBottom: 5 },
  actionLabel: { ...Typography.badge, color: Colors.t, fontWeight: '600' },
});
