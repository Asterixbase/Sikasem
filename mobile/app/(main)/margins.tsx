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
  Button,
  HorizontalBar,
  LoadingState,
  ErrorState,
} from '@/components';

interface CategoryMargin { name: string; margin_pct: number }
interface Performer { name: string; emoji: string; margin_pct: number }
interface MarginsData {
  avg_margin_pct: number;
  categories: CategoryMargin[];
  top_performers: Performer[];
  bottom_performers: Performer[];
}

const PERIOD_CHIPS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

function marginColor(pct: number): string {
  if (pct >= 30) return Colors.g2;
  if (pct >= 15) return Colors.at;
  return Colors.rt;
}

function marginVariant(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 30) return 'green';
  if (pct >= 15) return 'amber';
  return 'red';
}

export default function MarginsScreen() {
  const [period, setPeriod] = useState('30');

  const { data, isLoading, error } = useQuery<MarginsData>({
    queryKey: ['margins', period],
    queryFn: () => analyticsApi.margins(parseInt(period)).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading margins…" />;
  if (error || !data) return <ErrorState message="Could not load margin data" />;

  const maxCatPct = Math.max(...data.categories.map(c => c.margin_pct), 1);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profit Margins" />
      <SafeScrollView>
        {/* Hero */}
        <HeroCard
          label="AVERAGE MARGIN"
          value={`${data.avg_margin_pct.toFixed(1)}%`}
          subtitle={`Last ${period} days`}
        />

        {/* Period filter */}
        <ChipBar chips={PERIOD_CHIPS} active={period} onChange={setPeriod} />

        {/* Category breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CATEGORY BREAKDOWN</Text>
          {data.categories.map(cat => (
            <HorizontalBar
              key={cat.name}
              label={cat.name}
              value={`${cat.margin_pct.toFixed(1)}%`}
              pct={(cat.margin_pct / maxCatPct) * 100}
              color={marginColor(cat.margin_pct)}
            />
          ))}
        </View>

        {/* Top performers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOP PERFORMERS</Text>
          {data.top_performers.map((p, i) => (
            <View key={i} style={styles.performerRow}>
              <Text style={styles.performerEmoji}>{p.emoji}</Text>
              <Text style={styles.performerName} numberOfLines={1}>{p.name}</Text>
              <Badge label={`${p.margin_pct.toFixed(1)}%`} variant={marginVariant(p.margin_pct)} />
            </View>
          ))}
        </View>

        {/* Bottom performers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEEDS ATTENTION</Text>
          {data.bottom_performers.map((p, i) => (
            <View key={i} style={styles.performerRow}>
              <Text style={styles.performerEmoji}>{p.emoji}</Text>
              <Text style={styles.performerName} numberOfLines={1}>{p.name}</Text>
              <Badge label={`${p.margin_pct.toFixed(1)}%`} variant={marginVariant(p.margin_pct)} />
            </View>
          ))}
        </View>

        <Button
          label="View Sales Report"
          variant="primary"
          onPress={() => router.push('/(main)/sales-report')}
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
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.s2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
    gap: Spacing.s2,
  },
  performerEmoji: { fontSize: 18 },
  performerName: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
});
