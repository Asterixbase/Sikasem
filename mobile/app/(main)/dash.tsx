import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { SikasemLogo, MetricTile, LoadingState, ErrorState } from '@/components';

export default function DashScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading dashboard…" />;
  if (error || !data) return <ErrorState message="Could not load dashboard" onRetry={refetch} />;

  const d = data;
  const revenue = `GHS ${(d.today_revenue_pesawas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── App bar ──────────────────────────────────────────────────────── */}
      <View style={styles.appBar}>
        <SikasemLogo size="sm" layout="row" showTagline={false} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Revenue hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>TODAY'S REVENUE</Text>
          <Text style={styles.heroAmount}>{revenue}</Text>
          <Text style={styles.heroSub}>{d.total_skus} SKUs tracked</Text>
        </View>

        {/* Metric tiles 2×2 grid */}
        <View style={styles.tilesGrid}>
          <MetricTile label="Sold Today" value={String(d.sold_today_count)} onPress={() => router.push('/(main)/sold-today')} />
          <MetricTile label="Low Stock" value={String(d.low_stock_count)} positive={false} onPress={() => router.push('/(main)/low-stock')} />
          <MetricTile label="Avg Margin" value={`${d.avg_margin_pct.toFixed(1)}%`} positive />
          <MetricTile label="Total SKUs" value={String(d.total_skus)} onPress={() => router.push('/(main)/skus?id=all')} />
        </View>

        {/* Alerts */}
        {d.alerts.map((a, i) => (
          <View key={i} style={[styles.alert, a.urgency === 'critical' ? styles.alertRed : styles.alertAmber]}>
            <Text style={styles.alertText}>{a.message}</Text>
          </View>
        ))}

        {/* Quick actions */}
        <View style={styles.actions}>
          {[
            { icon: '📷', label: 'Scan', route: '/(main)/scan' },
            { icon: '💰', label: 'Sale', route: '/(main)/sale' },
            { icon: '🧾', label: 'Tax', route: '/(main)/tax' },
            { icon: '💳', label: 'Credit', route: '/(main)/credit-list' },
            { icon: '📊', label: 'Analytics', route: '/(main)/analytics' },
            { icon: '🏦', label: 'Vault', route: '/(main)/vault' },
            { icon: '🔁', label: 'Reorder', route: '/(main)/reorder' },
            { icon: '🔍', label: 'Search', route: '/(main)/search' },
            { icon: '📦', label: 'Batch', route: '/(main)/daily-batch' },
          ].map(a => (
            <Pressable key={a.route} style={styles.action} onPress={() => router.push(a.route as any)}>
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gy },
  appBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.s4, paddingVertical: 10,
    backgroundColor: Colors.w,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  hero: {
    backgroundColor: Colors.g, padding: Spacing.s6, paddingTop: Spacing.s8,
    margin: Spacing.s4, borderRadius: Radius.xl,
  },
  heroLabel: { ...Typography.label, color: 'rgba(255,255,255,0.7)' },
  heroAmount: { ...Typography.displayXL, color: Colors.w, marginTop: 4 },
  heroSub: { ...Typography.bodySM, color: 'rgba(255,255,255,0.65)', marginTop: 6 },
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.s4, marginBottom: Spacing.s2,
  },
  alert: { margin: Spacing.s4, padding: Spacing.s3, borderRadius: Radius.md },
  alertRed: { backgroundColor: Colors.r },
  alertAmber: { backgroundColor: Colors.a },
  alertText: { ...Typography.bodyMD, color: Colors.t },
  actions: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.s4, gap: 8 },
  action: {
    width: '30%', backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s3, alignItems: 'center', ...Shadows.card,
  },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionLabel: { ...Typography.badge, color: Colors.t },
});
