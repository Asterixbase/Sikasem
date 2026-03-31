import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  HeroCard,
  MetricTile,
  ChipBar,
  HorizontalBar,
  Button,
  LoadingState,
  ErrorState,
} from '@/components';

type Period = '7d' | '30d' | '90d';

interface CategoryBreakdown { name: string; pct: number; insight?: string }
interface RecentSale {
  name: string;
  emoji: string;
  amount_pesawas: number;
  date: string;
}
interface SalesReportData {
  revenue_pesawas: number;
  gross_profit_pesawas: number;
  transactions: number;
  avg_order_pesawas: number;
  return_rate_pct: number;
  categories: CategoryBreakdown[];
  recent_sales: RecentSale[];
}

const PERIOD_CHIPS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

export default function SalesReportScreen() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading, error } = useQuery<SalesReportData>({
    queryKey: ['salesReport', period],
    queryFn: () => analyticsApi.salesReport(period).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading sales report…" />;
  if (error || !data) return <ErrorState message="Could not load sales report" />;

  const d = data;
  const maxCatPct = Math.max(...d.categories.map(c => c.pct), 1);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Sales Report" />
      <SafeScrollView>
        {/* Period filter */}
        <ChipBar
          chips={PERIOD_CHIPS}
          active={period}
          onChange={v => setPeriod(v as Period)}
        />

        {/* Revenue hero */}
        <HeroCard
          label="TOTAL REVENUE"
          amount={d.revenue_pesawas}
          subtitle={`Last ${period.replace('d', ' days')}`}
        />

        {/* 2×2 metric grid */}
        <View style={styles.tileRow}>
          <MetricTile
            label="Gross Profit"
            value={`GHS ${(d.gross_profit_pesawas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
            positive
          />
          <MetricTile label="Transactions" value={String(d.transactions)} />
        </View>
        <View style={styles.tileRow}>
          <MetricTile
            label="Avg Order Value"
            value={`GHS ${(d.avg_order_pesawas / 100).toFixed(2)}`}
          />
          <MetricTile
            label="Return Rate"
            value={`${d.return_rate_pct.toFixed(1)}%`}
            positive={d.return_rate_pct < 5}
          />
        </View>

        {/* Category breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CATEGORY BREAKDOWN</Text>
          {d.categories.map(cat => (
            <View key={cat.name}>
              <HorizontalBar
                label={cat.name}
                value={`${cat.pct.toFixed(1)}%`}
                pct={(cat.pct / maxCatPct) * 100}
                color={Colors.g2}
              />
              {cat.insight ? (
                <Text style={styles.catInsight}>{cat.insight}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Recent high-value sales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT HIGH-VALUE SALES</Text>
          {d.recent_sales.map((sale, i) => (
            <View key={i} style={styles.saleRow}>
              <Text style={styles.saleEmoji}>{sale.emoji}</Text>
              <View style={styles.saleInfo}>
                <Text style={styles.saleName} numberOfLines={1}>{sale.name}</Text>
                <Text style={styles.saleDate}>{sale.date}</Text>
              </View>
              <Text style={styles.saleAmount}>
                GHS {(sale.amount_pesawas / 100).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <Button
          label="View Profit Margins"
          variant="primary"
          onPress={() => router.push('/(main)/margins')}
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
  catInsight: {
    ...Typography.bodySM,
    color: Colors.g,
    fontStyle: 'italic',
    marginTop: -4,
    marginBottom: Spacing.s3,
    paddingLeft: 2,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.s2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
    gap: Spacing.s2,
  },
  saleEmoji: { fontSize: 20 },
  saleInfo: { flex: 1 },
  saleName: { ...Typography.bodyLG, color: Colors.t },
  saleDate: { ...Typography.bodySM, color: Colors.t2 },
  saleAmount: { ...Typography.titleSM, color: Colors.g },
});
