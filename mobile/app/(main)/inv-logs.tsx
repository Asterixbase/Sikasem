import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, LoadingState, ErrorState } from '@/components';

interface Movement {
  id: string;
  product_name: string;
  movement_type: string;
  quantity: number;
  batch_ref?: string;
  ref?: string;
  created_at: string;
}

const MOCK_MOVEMENTS: Movement[] = [
  { id: '1', product_name: 'Milo 400g', movement_type: 'purchase', quantity: 120, batch_ref: 'BTH-001', ref: 'PO-2241', created_at: '28 Mar 2026 09:14' },
  { id: '2', product_name: 'Indomie Chicken', movement_type: 'adjustment', quantity: -5, batch_ref: 'BTH-002', ref: 'ADJ-041', created_at: '27 Mar 2026 14:32' },
  { id: '3', product_name: 'Close-Up 100ml', movement_type: 'adjustment', quantity: -3, batch_ref: 'BTH-003', ref: 'ADJ-042', created_at: '26 Mar 2026 11:05' },
  { id: '4', product_name: 'Cowbell Milk 400g', movement_type: 'purchase', quantity: 60, batch_ref: 'BTH-004', ref: 'PO-2242', created_at: '25 Mar 2026 08:50' },
  { id: '5', product_name: 'Geisha Sardines', movement_type: 'sale', quantity: -24, batch_ref: 'BTH-005', ref: 'SAL-991', created_at: '24 Mar 2026 16:18' },
];

function movementColor(qty: number, type: string): string {
  if (qty > 0) return Colors.g;
  if (type === 'adjustment') return Colors.at;
  return Colors.t2;
}

function movementLabel(qty: number): string {
  return qty > 0 ? `+${qty}` : String(qty);
}

export default function InvLogsScreen() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: () => inventoryApi.movements(50).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading inventory logs…" />;
  if (error) return <ErrorState message="Could not load movement logs" />;

  const movements: Movement[] = data?.movements ?? MOCK_MOVEMENTS;
  const filtered = movements.filter(m =>
    m.product_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Inventory Logs"
        subtitle="ARCHIVE MANAGEMENT / Recent Activity"
        onBack={() => router.push('/(main)/skus')}
      />
      <SafeScrollView>
        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products…"
            placeholderTextColor={Colors.t2}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {filtered.map((mov, idx) => (
            <View key={mov.id} style={styles.entry}>
              {/* Left column: circle + connector */}
              <View style={styles.leftCol}>
                <View style={[styles.circle, { backgroundColor: movementColor(mov.quantity, mov.movement_type) }]}>
                  <Text style={styles.circleText}>{movementLabel(mov.quantity)}</Text>
                </View>
                {idx < filtered.length - 1 && <View style={styles.connector} />}
              </View>
              {/* Right column: content */}
              <View style={styles.entryContent}>
                <Text style={styles.productName}>{mov.product_name}</Text>
                <Text style={styles.movType}>{mov.movement_type.toUpperCase()}</Text>
                <View style={styles.chipRow}>
                  {mov.batch_ref && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{mov.batch_ref}</Text>
                    </View>
                  )}
                  {mov.ref && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{mov.ref}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.timestamp}>{mov.created_at}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Insight card */}
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Inventory Health Insight</Text>
          <Text style={styles.insightText}>
            Stock turnover is healthy. 3 adjustments flagged this month — review batch BTH-002 and BTH-003 for damage patterns.
            Consider reorder on Indomie Chicken (current: 45 units, threshold: 50).
          </Text>
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    margin: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.s3,
    borderBottomWidth: 2, borderBottomColor: Colors.g,
    ...Shadows.card,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, ...Typography.bodyLG, color: Colors.t, paddingVertical: 10 },
  timeline: { paddingHorizontal: Spacing.s4, paddingTop: Spacing.s2 },
  entry: { flexDirection: 'row', marginBottom: 0 },
  leftCol: { width: 44, alignItems: 'center' },
  circle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  circleText: { ...Typography.micro, color: Colors.w, fontWeight: '700' },
  connector: { width: 2, flex: 1, backgroundColor: Colors.gy2, marginTop: 2, marginBottom: 0, minHeight: 20 },
  entryContent: {
    flex: 1, paddingLeft: Spacing.s3, paddingBottom: Spacing.s4, paddingTop: 4,
  },
  productName: { ...Typography.bodyLG, color: Colors.t },
  movType: { ...Typography.label, color: Colors.t2, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  chip: {
    backgroundColor: Colors.gy2, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  chipText: { ...Typography.micro, color: Colors.t2 },
  timestamp: { ...Typography.bodySM, color: Colors.t2, marginTop: 4 },
  insightCard: {
    margin: Spacing.s4, backgroundColor: Colors.g,
    borderRadius: Radius.lg, padding: Spacing.s5,
  },
  insightTitle: { ...Typography.titleMD, color: Colors.w, marginBottom: 8 },
  insightText: { ...Typography.bodyMD, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});
