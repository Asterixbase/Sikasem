import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  HeroCard,
  MetricTile,
  HorizontalBar,
  Badge,
  Button,
  LoadingState,
  ErrorState,
} from '@/components';

interface CategoryBar { name: string; pct: number }
interface AnalyticsData {
  net_profit_pesawas: number;
  profit_change_pct: number;
  total_revenue_pesawas: number;
  gross_profit_pesawas: number;
  transactions: number;
  avg_basket_pesawas: number;
  categories: CategoryBar[];
  insight_text: string;
  restock_count: number;
  overstock_count: number;
}

export default function AnalyticsScreen() {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.analytics().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading analytics…" />;
  if (error || !data) return <ErrorState message="Could not load analytics" />;

  const d = data;
  const changeLabel = `${d.profit_change_pct >= 0 ? '+' : ''}${d.profit_change_pct.toFixed(1)}%`;
  const maxCatPct = Math.max(...d.categories.map(c => c.pct), 1);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Shop Analytics" />
      <SafeScrollView>
        {/* Net profit hero */}
        <HeroCard
          label="NET PROFIT"
          amount={d.net_profit_pesawas}
          badge={changeLabel}
          subtitle="vs previous period"
        />

        {/* 2×2 KPI grid */}
        <View style={styles.tileRow}>
          <MetricTile
            label="Total Revenue"
            value={`GHS ${(d.total_revenue_pesawas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
          />
          <MetricTile
            label="Gross Profit"
            value={`GHS ${(d.gross_profit_pesawas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
          />
        </View>
        <View style={styles.tileRow}>
          <MetricTile label="Transactions" value={String(d.transactions)} />
          <MetricTile
            label="Avg Basket"
            value={`GHS ${(d.avg_basket_pesawas / 100).toFixed(2)}`}
          />
        </View>

        {/* Category bars */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SALES BY CATEGORY</Text>
          {d.categories.map(cat => (
            <HorizontalBar
              key={cat.name}
              label={cat.name}
              value={`${cat.pct}%`}
              pct={(cat.pct / maxCatPct) * 100}
              color={Colors.g2}
            />
          ))}
        </View>

        {/* Performance insights card */}
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>PERFORMANCE INSIGHTS</Text>
          <Text style={styles.insightText}>{d.insight_text}</Text>
        </View>

        {/* Inventory flow */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.s4, marginTop: Spacing.s2 }]}>
          INVENTORY FLOW
        </Text>
        <View style={styles.tileRow}>
          <Pressable
            style={[styles.invTile, { backgroundColor: Colors.a }]}
            onPress={() => router.push('/(main)/inv-logs')}
          >
            <Text style={[styles.invTileCount, { color: Colors.at }]}>{d.restock_count}</Text>
            <Text style={[styles.invTileLabel, { color: Colors.at }]}>RESTOCK ITEMS</Text>
            <Text style={styles.invTileArrow}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.invTile, { backgroundColor: Colors.b }]}
            onPress={() => router.push('/(main)/inv-logs')}
          >
            <Text style={[styles.invTileCount, { color: Colors.bt }]}>{d.overstock_count}</Text>
            <Text style={[styles.invTileLabel, { color: Colors.bt }]}>OVERSTOCK ITEMS</Text>
            <Text style={styles.invTileArrow}>›</Text>
          </Pressable>
        </View>

        <Button
          label="Retail Insights"
          variant="primary"
          onPress={() => router.push('/(main)/retail-insights')}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gy },
  tileRow: { flexDirection: 'row', paddingHorizontal: Spacing.s4 },
  section: {
    backgroundColor: Colors.w,
    margin: Spacing.s4,
    marginTop: 0,
    borderRadius: Radius.lg,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.t2,
    marginBottom: Spacing.s3,
  },
  insightCard: {
    backgroundColor: '#1a3d2b',
    margin: Spacing.s4,
    marginTop: 0,
    borderRadius: Radius.lg,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  insightLabel: {
    ...Typography.label,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.s3,
  },
  insightText: {
    ...Typography.bodyMD,
    color: Colors.w,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  invTile: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    margin: 4,
    ...Shadows.card,
    position: 'relative',
  },
  invTileCount: { ...Typography.displayMD },
  invTileLabel: { ...Typography.label, marginTop: 2 },
  invTileArrow: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: 18,
    color: Colors.t2,
  },
});
