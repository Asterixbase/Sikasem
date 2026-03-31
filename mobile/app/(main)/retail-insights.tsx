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
  ChipBar,
  Badge,
  HorizontalBar,
  SimpleBarChart,
  Button,
  LoadingState,
  ErrorState,
} from '@/components';

interface DayBar { label: string; value: number; peak?: boolean }
interface PeakTime { label: string; pct: number }
interface TopItem { name: string; emoji: string; margin: 'high' | 'fair' | 'low' }
interface RetailInsightsData {
  weekly_revenue_pesawas: number;
  weekly_profit_pesawas: number;
  daily_data: DayBar[];
  weekly_data: DayBar[];
  peak_times: PeakTime[];
  top_items: TopItem[];
  stock_warning: string;
}

const VIEW_CHIPS = [
  { label: 'DAILY', value: 'daily' },
  { label: 'WEEKLY', value: 'weekly' },
];

function marginVariant(m: string): 'green' | 'amber' | 'red' {
  if (m === 'high') return 'green';
  if (m === 'fair') return 'amber';
  return 'red';
}

function marginLabel(m: string): string {
  if (m === 'high') return 'HIGH MARGIN';
  if (m === 'fair') return 'FAIR MARGIN';
  return 'LOW MARGIN';
}

export default function RetailInsightsScreen() {
  const [view, setView] = useState('daily');

  const { data, isLoading, error } = useQuery<RetailInsightsData>({
    queryKey: ['retailInsights'],
    queryFn: () => analyticsApi.retailInsights().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading retail insights…" />;
  if (error || !data) return <ErrorState message="Could not load retail insights" />;

  const chartData = view === 'daily' ? data.daily_data : data.weekly_data;
  const maxPeakPct = Math.max(...data.peak_times.map(p => p.pct), 1);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Retail Insights" subtitle="Weekly archive" />
      <SafeScrollView>
        {/* Revenue hero */}
        <HeroCard
          label="WEEKLY REVENUE"
          amount={data.weekly_revenue_pesawas}
          subtitle={`Weekly profit GHS ${(data.weekly_profit_pesawas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
        />

        {/* Toggle chips + bar chart */}
        <ChipBar chips={VIEW_CHIPS} active={view} onChange={setView} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {view === 'daily' ? '7-DAY SALES' : 'WEEKLY TREND'}
          </Text>
          <SimpleBarChart data={chartData} />
        </View>

        {/* Peak times */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PEAK TRADING TIMES</Text>
          {data.peak_times.map(pt => (
            <HorizontalBar
              key={pt.label}
              label={pt.label}
              value={`${pt.pct}%`}
              pct={(pt.pct / maxPeakPct) * 100}
              color={pt.pct === maxPeakPct ? Colors.g2 : Colors.gy2}
            />
          ))}
        </View>

        {/* Top performing items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOP PERFORMING ITEMS</Text>
          {data.top_items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Badge label={marginLabel(item.margin)} variant={marginVariant(item.margin)} />
            </View>
          ))}
        </View>

        {/* Stock warning */}
        {data.stock_warning ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>{data.stock_warning}</Text>
          </View>
        ) : null}

        <Button
          label="Back to Analytics"
          variant="secondary"
          onPress={() => router.push('/(main)/analytics')}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gy },
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.s2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
    gap: Spacing.s2,
  },
  itemEmoji: { fontSize: 18 },
  itemName: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.r,
    margin: Spacing.s4,
    marginTop: 0,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.rt,
    gap: Spacing.s2,
  },
  warningIcon: { fontSize: 16 },
  warningText: { ...Typography.bodyMD, color: Colors.rt, flex: 1, lineHeight: 18 },
});
