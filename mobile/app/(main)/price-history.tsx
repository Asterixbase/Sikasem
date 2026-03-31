import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  HeroCard,
  Badge,
  HorizontalBar,
  Button,
  LoadingState,
  ErrorState,
} from '@/components';

type Volatility = 'Low' | 'Medium' | 'High';

interface SupplierBenchmark {
  supplier_name: string;
  avg_price_pesawas: number;
  is_cheapest: boolean;
}
interface LedgerEntry {
  date: string;
  supplier_name: string;
  qty: number;
  unit_price_pesawas: number;
}
interface PriceHistoryData {
  product_id: string;
  name: string;
  emoji: string;
  volatility: Volatility;
  avg_price_pesawas: number;
  best_supplier: string;
  best_saving_pesawas: number;
  risk_supplier: string;
  risk_increase_pct: number;
  benchmarks: SupplierBenchmark[];
  ledger: LedgerEntry[];
}

function volatilityVariant(v: Volatility): 'green' | 'amber' | 'red' {
  if (v === 'Low') return 'green';
  if (v === 'Medium') return 'amber';
  return 'red';
}

export default function PriceHistoryScreen() {
  const { product_id } = useLocalSearchParams<{ product_id: string }>();

  const { data, isLoading, error } = useQuery<PriceHistoryData>({
    queryKey: ['priceHistory', product_id],
    queryFn: () => productsApi.priceHistory(product_id ?? '').then(r => r.data),
    enabled: !!product_id,
  });

  if (isLoading) return <LoadingState message="Loading price history…" />;
  if (error || !data) return <ErrorState message="Could not load price history" />;

  const d = data;
  const maxBenchmarkPrice = Math.max(...d.benchmarks.map(b => b.avg_price_pesawas), 1);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Price History" />
      <SafeScrollView>
        {/* SKU card */}
        <View style={styles.skuCard}>
          <Text style={styles.skuEmoji}>{d.emoji}</Text>
          <View style={styles.skuInfo}>
            <Text style={styles.skuName}>{d.name}</Text>
            <Text style={styles.skuId}>ID: {d.product_id}</Text>
          </View>
          <Badge label={d.volatility} variant={volatilityVariant(d.volatility)} />
        </View>

        {/* Avg price hero */}
        <HeroCard
          label="CURRENT AVG PRICE"
          amount={d.avg_price_pesawas}
          subtitle="Based on last 3 purchases"
        />

        {/* Supplier benchmarking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPLIER BENCHMARKING</Text>
          {d.benchmarks.map(b => (
            <HorizontalBar
              key={b.supplier_name}
              label={b.supplier_name}
              value={`GHS ${(b.avg_price_pesawas / 100).toFixed(2)}`}
              pct={(b.avg_price_pesawas / maxBenchmarkPrice) * 100}
              color={b.is_cheapest ? Colors.g2 : Colors.t2}
            />
          ))}
        </View>

        {/* Insight cards */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Text style={styles.insightIcon}>✅</Text>
            <Text style={[styles.insightTitle, { color: Colors.g }]}>Best Price Opportunity</Text>
          </View>
          <Text style={styles.insightBody}>
            <Text style={styles.insightBold}>{d.best_supplier}</Text>
            {' '}· Potential saving of{' '}
            <Text style={styles.insightBold}>
              GHS {(d.best_saving_pesawas / 100).toFixed(2)}
            </Text>
            {' '}per order vs current average.
          </Text>
        </View>

        <View style={[styles.insightCard, styles.insightRisk]}>
          <View style={styles.insightHeader}>
            <Text style={styles.insightIcon}>⚠️</Text>
            <Text style={[styles.insightTitle, { color: Colors.rt }]}>Cost Risk</Text>
          </View>
          <Text style={[styles.insightBody, { color: Colors.rt }]}>
            <Text style={styles.insightBold}>{d.risk_supplier}</Text>
            {' '}has raised prices by{' '}
            <Text style={styles.insightBold}>{d.risk_increase_pct.toFixed(1)}%</Text>
            {' '}in the last period.
          </Text>
        </View>

        {/* Purchase ledger */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PURCHASE LEDGER</Text>
          {d.ledger.map((entry, i) => (
            <View key={i} style={styles.ledgerRow}>
              <View style={styles.ledgerLeft}>
                <Text style={styles.ledgerDate}>{entry.date}</Text>
                <Text style={styles.ledgerSupplier}>{entry.supplier_name}</Text>
              </View>
              <View style={styles.ledgerRight}>
                <Text style={styles.ledgerQty}>Qty {entry.qty}</Text>
                <Text style={styles.ledgerPrice}>
                  GHS {(entry.unit_price_pesawas / 100).toFixed(2)}/unit
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Button
          label="Back to Supplier Prices"
          variant="secondary"
          onPress={() => router.push('/(main)/sup')}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gy },
  skuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.w,
    margin: Spacing.s4,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    gap: Spacing.s3,
    ...Shadows.card,
  },
  skuEmoji: { fontSize: 28 },
  skuInfo: { flex: 1 },
  skuName: { ...Typography.titleSM, color: Colors.t },
  skuId: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
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
    backgroundColor: Colors.gl,
    margin: Spacing.s4,
    marginTop: 0,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.g,
    ...Shadows.card,
  },
  insightRisk: {
    backgroundColor: Colors.r,
    borderLeftColor: Colors.rt,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.s2,
  },
  insightIcon: { fontSize: 15 },
  insightTitle: { ...Typography.titleSM },
  insightBody: { ...Typography.bodyMD, color: Colors.t, lineHeight: 18 },
  insightBold: { fontWeight: '700' },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.s2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
  },
  ledgerLeft: { flex: 1 },
  ledgerRight: { alignItems: 'flex-end' },
  ledgerDate: { ...Typography.badge, color: Colors.t2 },
  ledgerSupplier: { ...Typography.bodyMD, color: Colors.t, marginTop: 1 },
  ledgerQty: { ...Typography.badge, color: Colors.t2 },
  ledgerPrice: { ...Typography.bodyMD, color: Colors.t, marginTop: 1, fontWeight: '600' },
});
