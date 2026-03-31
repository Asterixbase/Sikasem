import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, LoadingState, Button, Badge } from '@/components';

export default function SkusScreen() {
  const { id, barcode } = useLocalSearchParams<{ id?: string; barcode?: string }>();
  const queryFn = barcode
    ? () => productsApi.getByBarcode(barcode).then(r => r.data)
    : () => productsApi.getById(id!).then(r => r.data);

  const { data: p, isLoading } = useQuery({
    queryKey: ['product', id ?? barcode],
    queryFn,
    enabled: !!(id || barcode),
  });

  if (isLoading) return <LoadingState />;
  if (!p) return <ScreenHeader title="Product not found" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title={p.name} />
      <ScrollView>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.emoji}>{p.emoji}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.breadcrumb}>{p.category_breadcrumb}</Text>
          <View style={styles.tags}>
            <Badge label={`${p.current_stock} in stock`} variant={p.urgency === 'critical' ? 'red' : p.urgency === 'high' ? 'amber' : 'green'} />
            <Badge label={p.urgency.toUpperCase()} variant={p.urgency === 'critical' ? 'red' : 'amber'} />
          </View>
        </View>

        {/* Analysis */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>INVENTORY ANALYSIS</Text>
          <Text style={styles.stat}>{p.current_stock} units · {p.daily_velocity.toFixed(1)}/day velocity</Text>
        </View>

        {/* Margin */}
        <View style={[styles.card, { backgroundColor: Colors.g }]}>
          <Text style={[styles.cardLabel, { color: 'rgba(255,255,255,0.7)' }]}>MARGIN</Text>
          <Text style={[styles.stat, { color: Colors.w, fontSize: 28, fontWeight: '900' }]}>{p.margin_pct.toFixed(1)}%</Text>
        </View>

        {/* Prices */}
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <View><Text style={styles.cardLabel}>BUY PRICE</Text><Text style={styles.price}>GHS {(p.buy_price_pesawas/100).toFixed(2)}</Text></View>
            <View><Text style={styles.cardLabel}>SELL PRICE</Text><Text style={[styles.price,{color:Colors.g}]}>GHS {(p.sell_price_pesawas/100).toFixed(2)}</Text></View>
          </View>
        </View>

        {/* Supplier history */}
        {p.supplier_history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SUPPLIER HISTORY</Text>
            {p.supplier_history.map((s, i) => (
              <View key={i} style={styles.supRow}>
                <Text style={styles.supName}>{s.name}</Text>
                <Text style={styles.supDate}>{s.date}</Text>
                <Text style={styles.supPrice}>GHS {(s.unit_cost_pesawas/100).toFixed(2)}</Text>
                {s.best && <Badge label="BEST" variant="green" />}
              </View>
            ))}
          </View>
        )}

        <Button label="Adjust Inventory" variant="secondary" onPress={() => router.push({ pathname:'/(main)/inv-adjust', params:{id:p.product_id} })} />
        <Button label="View Logs" variant="secondary" onPress={() => router.push('/(main)/inv-logs')} />
        <Button label="Inventory Audit" variant="secondary" onPress={() => router.push('/(main)/inv-audit')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: Colors.w, padding: Spacing.s6, alignItems: 'center', marginBottom: 8 },
  emoji: { fontSize: 56, marginBottom: 8 },
  name: { ...Typography.titleLG, color: Colors.t },
  breadcrumb: { ...Typography.bodySM, color: Colors.t2, marginTop: 4 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 8 },
  card: { backgroundColor: Colors.w, margin: Spacing.s4, marginTop: 0, marginBottom: 8, borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card },
  cardLabel: { ...Typography.label, color: Colors.t2, marginBottom: 4 },
  stat: { ...Typography.titleMD, color: Colors.t },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  price: { ...Typography.titleMD, color: Colors.t, marginTop: 4 },
  supRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  supName: { ...Typography.bodyMD, color: Colors.t, flex: 1 },
  supDate: { ...Typography.bodySM, color: Colors.t2 },
  supPrice: { ...Typography.bodyMD, color: Colors.t },
});
