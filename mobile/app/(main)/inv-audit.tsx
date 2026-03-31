import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader, SafeScrollView, HeroCard, Button,
  Badge, ChipBar, LoadingState, ErrorState,
} from '@/components';

type AuditFilter = 'all' | 'to-audit' | 'discrepancies';

interface AuditItem {
  id: string;
  emoji: string;
  name: string;
  system_qty: number;
  counted_qty: number | null;
  status: 'matched' | 'discrepancy' | 'to-audit';
}

const MOCK_ITEMS: AuditItem[] = [
  { id: '1', emoji: '🍫', name: 'Milo 400g', system_qty: 84, counted_qty: 84, status: 'matched' },
  { id: '2', emoji: '🍜', name: 'Indomie Chicken 70g', system_qty: 45, counted_qty: 43, status: 'discrepancy' },
  { id: '3', emoji: '🦷', name: 'Close-Up 100ml', system_qty: 30, counted_qty: null, status: 'to-audit' },
  { id: '4', emoji: '🥛', name: 'Cowbell Milk 400g', system_qty: 62, counted_qty: 62, status: 'matched' },
  { id: '5', emoji: '🐟', name: 'Geisha Sardines', system_qty: 38, counted_qty: 35, status: 'discrepancy' },
  { id: '6', emoji: '🧴', name: 'Dettol 200ml', system_qty: 20, counted_qty: null, status: 'to-audit' },
];

function statusBadge(status: AuditItem['status'], diff: number) {
  if (status === 'matched') return <Badge label="MATCHED ✓" variant="green" />;
  if (status === 'discrepancy') return <Badge label={`${diff} DIFF ⚠`} variant="amber" />;
  return <Badge label="TO AUDIT ⋯" variant="blue" />;
}

export default function InvAuditScreen() {
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-audit'],
    queryFn: () => inventoryApi.audit().then(r => r.data),
  });

  const { mutate: confirmAudit, isPending } = useMutation({
    mutationFn: () =>
      inventoryApi.confirmAudit({
        audit_id: data?.audit_id ?? 'AUD-2026-03',
        signed_by: 'Manager',
        items: MOCK_ITEMS
          .filter(i => i.counted_qty !== null)
          .map(i => ({ product_id: i.id, actual_qty: i.counted_qty! })),
      }),
    onSuccess: () => Alert.alert('Audit Confirmed', 'Audit has been signed and recorded'),
    onError: () => Alert.alert('Error', 'Could not confirm audit'),
  });

  if (isLoading) return <LoadingState message="Loading audit data…" />;
  if (error) return <ErrorState message="Could not load audit" />;

  const items: AuditItem[] = data?.items ?? MOCK_ITEMS;
  const verified = items.filter(i => i.status !== 'to-audit').length;
  const total = items.length;
  const pct = Math.round((verified / total) * 100);
  const discrepancies = items.filter(i => i.status === 'discrepancy');
  const variance = discrepancies.reduce((acc, i) => acc + (i.counted_qty ?? i.system_qty) - i.system_qty, 0);

  const filtered = items
    .filter(i => filter === 'all' ? true : filter === 'discrepancies' ? i.status === 'discrepancy' : i.status === 'to-audit')
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.root}>
      <ScreenHeader title="Inventory Audit" />
      <SafeScrollView>
        {/* Hero progress */}
        <HeroCard
          label={`${verified} of ${total} SKUs Verified (${pct}%)`}
          value={`${pct}%`}
        >
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </HeroCard>

        {/* Discrepancy warning */}
        {discrepancies.length > 0 && (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>{discrepancies.length} discrepancies found</Text>
            <Text style={styles.warnSub}>GHS {Math.abs(variance / 100).toFixed(2)} variance</Text>
          </View>
        )}

        {/* Search */}
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

        {/* Filter chips */}
        <ChipBar
          chips={[
            { label: 'All', value: 'all' },
            { label: 'To Audit', value: 'to-audit' },
            { label: 'Discrepancies', value: 'discrepancies' },
          ]}
          active={filter}
          onChange={v => setFilter(v as AuditFilter)}
        />

        {/* Product rows */}
        <View style={styles.productList}>
          {filtered.map((item, idx) => {
            const diff = (item.counted_qty ?? item.system_qty) - item.system_qty;
            return (
              <View key={item.id} style={[styles.productRow, idx === filtered.length - 1 && styles.noBorder]}>
                <Text style={styles.productEmoji}>{item.emoji}</Text>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.stockInfo}>
                    System: {item.system_qty}
                    {item.counted_qty !== null ? ` · Counted: ${item.counted_qty}` : ' · Not yet counted'}
                  </Text>
                </View>
                {statusBadge(item.status, diff)}
              </View>
            );
          })}
        </View>

        <Button
          label="Confirm & Sign Audit"
          variant="primary"
          loading={isPending}
          onPress={() => confirmAudit()}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  progressBar: {
    marginTop: 10, height: 6, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: Colors.w, borderRadius: 3 },
  warnCard: {
    margin: Spacing.s4, backgroundColor: Colors.a,
    borderRadius: Radius.lg, padding: Spacing.s4,
    borderLeftWidth: 4, borderLeftColor: Colors.at,
  },
  warnTitle: { ...Typography.titleMD, color: Colors.at },
  warnSub: { ...Typography.bodyMD, color: Colors.at, marginTop: 2 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s2,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.s3,
    borderBottomWidth: 2, borderBottomColor: Colors.g,
    ...Shadows.card,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, ...Typography.bodyLG, color: Colors.t, paddingVertical: 10 },
  productList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
    marginBottom: Spacing.s3,
  },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  productEmoji: { fontSize: 28, marginRight: Spacing.s3 },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { ...Typography.bodyLG, color: Colors.t },
  stockInfo: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
});
