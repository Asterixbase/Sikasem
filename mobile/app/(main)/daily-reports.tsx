/**
 * Daily Reports — owner's all-in-one operational view.
 *
 * Three panels:
 *  1. Morning Stock Check (real-time stock status with urgency tiers)
 *  2. Daily Reconciliation (POS sales vs stock movements, flags discrepancies)
 *  3. End-of-Day Summary  (revenue, gross profit, payment breakdown, top 5)
 *
 * All panels pull from /reports/* endpoints. Accessible from the dashboard
 * via the "Reports" quick action or from any screen header.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { useThemePalette } from '@/store/theme';
import {
  ScreenHeader, SafeScrollView, HeroCard, Badge,
  LoadingState, ErrorState,
} from '@/components';

type Panel = 'stock' | 'reconcile' | 'eod';

const PANELS: { key: Panel; label: string; icon: string }[] = [
  { key: 'stock',     label: 'Stock Check', icon: '📦' },
  { key: 'reconcile', label: 'Reconcile',   icon: '⚖️' },
  { key: 'eod',       label: 'EOD Summary', icon: '📊' },
];

// ── Morning Stock Check ────────────────────────────────────────────────────────
type StockTier = 'all' | 'critical' | 'low' | 'healthy';

function MorningStockPanel() {
  const theme = useThemePalette();
  const [filterTier, setFilterTier] = useState<StockTier>('all');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['morning-stock'],
    queryFn: () => analyticsApi.morningStock().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading stock levels…" />;
  if (error || !data) return <ErrorState message="Could not load stock check" onRetry={refetch} />;

  const urgencyLabel = (item: any) => {
    if (item.days_remaining <= 2 || item.current_stock === 0) return { label: 'CRITICAL', variant: 'red' as const };
    if (item.days_remaining <= 7 || item.current_stock <= 5)  return { label: 'LOW',      variant: 'amber' as const };
    return { label: 'OK', variant: 'green' as const };
  };

  const allItems = [...data.critical, ...data.low, ...data.healthy];
  const filteredItems = filterTier === 'all' ? allItems
    : filterTier === 'critical' ? data.critical
    : filterTier === 'low'      ? data.low
    : data.healthy;

  const toggleTier = (tier: StockTier) =>
    setFilterTier(prev => prev === tier ? 'all' : tier);

  return (
    <View>
      {/* Summary tiles — tap to filter */}
      <View style={styles.tileRow}>
        <Pressable
          style={[styles.summaryTile, { borderTopColor: Colors.rt }, filterTier === 'critical' && styles.tileActive]}
          onPress={() => toggleTier('critical')}
        >
          <Text style={[styles.summaryNum, { color: Colors.rt }]}>{data.critical_count}</Text>
          <Text style={styles.summaryLabel}>CRITICAL</Text>
        </Pressable>
        <Pressable
          style={[styles.summaryTile, { borderTopColor: Colors.at }, filterTier === 'low' && styles.tileActive]}
          onPress={() => toggleTier('low')}
        >
          <Text style={[styles.summaryNum, { color: Colors.at }]}>{data.low_count}</Text>
          <Text style={styles.summaryLabel}>LOW STOCK</Text>
        </Pressable>
        <Pressable
          style={[styles.summaryTile, { borderTopColor: theme.primary }, filterTier === 'healthy' && styles.tileActive]}
          onPress={() => toggleTier('healthy')}
        >
          <Text style={[styles.summaryNum, { color: theme.primary }]}>{data.healthy_count}</Text>
          <Text style={styles.summaryLabel}>HEALTHY</Text>
        </Pressable>
      </View>

      {/* Product list */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {filterTier === 'all' ? `ALL PRODUCTS (${data.total_skus} SKUs)`
            : filterTier === 'critical' ? `CRITICAL (${data.critical_count})`
            : filterTier === 'low'      ? `LOW STOCK (${data.low_count})`
            : `HEALTHY (${data.healthy_count})`}
          {filterTier !== 'all' && '  — TAP TILE TO CLEAR'}
        </Text>
        {filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>
            {filterTier === 'all' ? 'No products in inventory yet' : 'No items in this tier'}
          </Text>
        ) : filteredItems.map((item: any) => {
          const { label, variant } = urgencyLabel(item);
          return (
            <View key={item.product_id} style={styles.stockRow}>
              <Text style={styles.stockEmoji}>{item.emoji}</Text>
              <View style={styles.stockInfo}>
                <Text style={styles.stockName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.stockMeta}>
                  {item.current_stock} units · {item.days_remaining < 999 ? `${item.days_remaining}d left` : 'no velocity'}
                </Text>
              </View>
              <Badge label={label} variant={variant} />
            </View>
          );
        })}
      </View>

      {data.critical_count > 0 && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(main)/low-stock')}
        >
          <Text style={styles.actionBtnText}>Manage Reorders →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Daily Reconciliation ───────────────────────────────────────────────────────
function ReconcilePanel() {
  const theme = useThemePalette();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily-reconciliation'],
    queryFn: () => analyticsApi.dailyReconciliation().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Running reconciliation…" />;
  if (error || !data) return <ErrorState message="Could not load reconciliation" onRetry={refetch} />;

  const balanced = data.status === 'balanced';

  return (
    <View>
      {/* Status banner */}
      <View style={[
        styles.reconcileBanner,
        { backgroundColor: balanced ? Colors.gl : Colors.a, borderColor: balanced ? theme.primary : Colors.at },
      ]}>
        <Text style={styles.reconcileBannerIcon}>{balanced ? '✅' : '⚠️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reconcileBannerTitle, { color: balanced ? theme.primary : Colors.at }]}>
            {balanced ? 'All records balanced' : `${data.summary.discrepancy_count} discrepancies found`}
          </Text>
          <Text style={styles.reconcileBannerSub}>
            POS: {data.summary.total_sold} units sold · Stock log: {data.summary.total_stock_moved} units moved
          </Text>
        </View>
      </View>

      {/* Per-product table */}
      {data.items.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No sales recorded today</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>PRODUCT</Text>
            <Text style={styles.tableNum}>SOLD</Text>
            <Text style={styles.tableNum}>MOVED</Text>
            <Text style={styles.tableNum}>DIFF</Text>
          </View>
          {data.items.map((item: any) => (
            <View
              key={item.product_id}
              style={[styles.tableRow, item.flag && { backgroundColor: Colors.a }]}
            >
              <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                {item.emoji} {item.name}
              </Text>
              <Text style={styles.tableNum}>{item.units_sold}</Text>
              <Text style={styles.tableNum}>{item.stock_moved}</Text>
              <Text style={[
                styles.tableNum,
                { color: item.flag ? Colors.at : Colors.g2, fontWeight: '700' },
              ]}>
                {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── End-of-Day Summary ─────────────────────────────────────────────────────────
function EodPanel() {
  const theme = useThemePalette();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['eod-summary'],
    queryFn: () => analyticsApi.eodSummary().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Preparing EOD summary…" />;
  if (error || !data) return <ErrorState message="Could not load EOD summary" onRetry={refetch} />;

  const balanced = data.reconciliation.status === 'balanced';
  const pb = data.payment_breakdown;

  return (
    <View>
      <HeroCard
        label="TODAY'S REVENUE"
        amount={data.revenue_pesawas}
        badge={`${data.transactions} transactions`}
        subtitle={`Gross profit: GHS ${(data.gross_profit_pesawas / 100).toFixed(2)}`}
      />

      {/* Payment breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>PAYMENT BREAKDOWN</Text>
        {(['cash', 'momo', 'credit'] as const).map(m => (
          <View key={m} style={styles.payRow}>
            <Text style={styles.payLabel}>{m.toUpperCase()}</Text>
            <View style={styles.payBarWrap}>
              <View style={[
                styles.payBar,
                {
                  width: data.revenue_pesawas > 0
                    ? `${Math.round((pb[m] / data.revenue_pesawas) * 100)}%` as any
                    : '0%',
                  backgroundColor: m === 'cash' ? theme.primary : m === 'momo' ? Colors.bt : Colors.at,
                },
              ]} />
            </View>
            <Text style={styles.payAmount}>GHS {(pb[m] / 100).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Top 5 products */}
      {data.top_products.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TOP PRODUCTS TODAY</Text>
          {data.top_products.map((p: any, i: number) => (
            <View key={p.product_id} style={styles.topRow}>
              <Text style={styles.topRank}>{i + 1}</Text>
              <Text style={styles.topEmoji}>{p.emoji}</Text>
              <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
              <View style={styles.topRight}>
                <Text style={[styles.topRevenue, { color: theme.primary }]}>
                  GHS {(p.revenue_pesawas / 100).toFixed(2)}
                </Text>
                <Text style={styles.topQty}>{p.qty_sold} sold</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Reconciliation status */}
      <View style={[
        styles.reconcileBanner,
        { backgroundColor: balanced ? Colors.gl : Colors.a, borderColor: balanced ? theme.primary : Colors.at },
      ]}>
        <Text style={styles.reconcileBannerIcon}>{balanced ? '✅' : '⚠️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reconcileBannerTitle, { color: balanced ? theme.primary : Colors.at }]}>
            Reconciliation: {balanced ? 'Balanced' : 'Discrepancy'}
          </Text>
          <Text style={styles.reconcileBannerSub}>
            POS sold {data.reconciliation.pos_units_sold} units · stock log moved {data.reconciliation.stock_units_moved}
            {!balanced && ` · Difference: ${data.reconciliation.delta > 0 ? '+' : ''}${data.reconciliation.delta}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function DailyReportsScreen() {
  const theme = useThemePalette();
  const [active, setActive] = useState<Panel>('stock');

  return (
    <View style={styles.root}>
      <ScreenHeader title="Daily Reports" subtitle={new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })} />

      {/* Panel selector tabs */}
      <View style={styles.tabs}>
        {PANELS.map(p => (
          <Pressable
            key={p.key}
            style={[styles.tab, active === p.key && { backgroundColor: theme.primary }]}
            onPress={() => setActive(p.key)}
          >
            <Text style={styles.tabIcon}>{p.icon}</Text>
            <Text style={[styles.tabLabel, active === p.key && { color: Colors.w }]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SafeScrollView>
        {active === 'stock'     && <MorningStockPanel />}
        {active === 'reconcile' && <ReconcilePanel />}
        {active === 'eod'       && <EodPanel />}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s2,
    gap: Spacing.s2,
    backgroundColor: Colors.w,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderRadius: Radius.md,
    backgroundColor: Colors.gy,
  },
  tabIcon:  { fontSize: 14 },
  tabLabel: { ...Typography.badge, color: Colors.t2 },

  tileRow: { flexDirection: 'row', paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, gap: Spacing.s2 },
  summaryTile: {
    flex: 1, backgroundColor: Colors.w, borderRadius: Radius.md,
    padding: Spacing.s3, alignItems: 'center',
    borderTopWidth: 3, ...Shadows.card,
  },
  tileActive: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  summaryNum:   { ...Typography.displayMD, fontWeight: '700' },
  summaryLabel: { ...Typography.label, color: Colors.t2, marginTop: 2 },

  card: {
    backgroundColor: Colors.w,
    margin: Spacing.s4, marginTop: Spacing.s3,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    ...Shadows.card,
  },
  cardTitle: { ...Typography.label, color: Colors.t2, marginBottom: Spacing.s3 },
  emptyText: { ...Typography.bodyMD, color: Colors.t2, textAlign: 'center', padding: Spacing.s4 },

  stockRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    paddingVertical: Spacing.s2,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  stockEmoji: { fontSize: 18, width: 28 },
  stockInfo:  { flex: 1 },
  stockName:  { ...Typography.bodyMD, color: Colors.t, fontWeight: '600' },
  stockMeta:  { ...Typography.bodySM, color: Colors.t2, marginTop: 1 },

  actionBtn: {
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s4,
    borderRadius: Radius.md, paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: { ...Typography.titleSM, color: Colors.w },

  reconcileBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    borderRadius: Radius.lg, borderWidth: 1.5,
    padding: Spacing.s4,
  },
  reconcileBannerIcon:  { fontSize: 24 },
  reconcileBannerTitle: { ...Typography.titleSM, marginBottom: 2 },
  reconcileBannerSub:   { ...Typography.bodySM, color: Colors.t2 },

  tableHeader: {
    flexDirection: 'row', paddingBottom: Spacing.s2,
    borderBottomWidth: 2, borderBottomColor: Colors.gy2,
    marginBottom: Spacing.s2,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderRadius: Radius.sm, paddingHorizontal: 4,
  },
  tableCell: { ...Typography.bodySM, color: Colors.t },
  tableNum:  { ...Typography.bodyMD, color: Colors.t, width: 52, textAlign: 'center', fontWeight: '600' },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2, marginBottom: Spacing.s2 },
  payLabel: { ...Typography.badge, color: Colors.t2, width: 52 },
  payBarWrap: { flex: 1, height: 8, backgroundColor: Colors.gy2, borderRadius: 4, overflow: 'hidden' },
  payBar: { height: '100%', borderRadius: 4 },
  payAmount: { ...Typography.bodyMD, color: Colors.t, width: 80, textAlign: 'right' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2, paddingVertical: Spacing.s2 },
  topRank:    { ...Typography.bodyMD, color: Colors.t2, width: 20, textAlign: 'center' },
  topEmoji:   { fontSize: 18, width: 28 },
  topName:    { ...Typography.bodyMD, color: Colors.t, flex: 1 },
  topRight:   { alignItems: 'flex-end' },
  topRevenue: { ...Typography.bodyMD, fontWeight: '700' },
  topQty:     { ...Typography.bodySM, color: Colors.t2 },
});
