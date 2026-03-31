import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { creditApi } from '@/api';
import {
  ScreenHeader, SafeScrollView, HeroCard, ChipBar,
  Badge, LoadingState, ErrorState, Button,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows, CreditStatus } from '@/constants';

type Filter = 'all' | 'overdue' | 'due_tomorrow' | 'pending';

interface CreditSale {
  id: string;
  customer_name: string;
  amount_pesawas: number;
  due_date: string;
  status: 'overdue' | 'due_tomorrow' | 'pending' | 'paid' | 'written_off';
}

const CHIPS = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due Tomorrow', value: 'due_tomorrow' },
  { label: 'Pending', value: 'pending' },
];

function statusBadgeVariant(status: string): 'red' | 'amber' | 'blue' | 'green' {
  if (status === 'overdue') return 'red';
  if (status === 'due_tomorrow') return 'red';
  if (status === 'pending') return 'blue';
  return 'green';
}

function statusLabel(status: string): string {
  if (status === 'overdue') return 'OVERDUE';
  if (status === 'due_tomorrow') return 'DUE TOMORROW';
  if (status === 'pending') return 'PENDING';
  if (status === 'paid') return 'PAID';
  return status.toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GH', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export default function CreditListScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['credit-list'],
    queryFn: () => creditApi.list().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading credit portfolio…" />;
  if (error) return <ErrorState message="Could not load credit sales" onRetry={refetch} />;

  const sales: CreditSale[] = data?.sales ?? data ?? [];

  const filtered = filter === 'all'
    ? sales
    : sales.filter((s: CreditSale) => s.status === filter);

  const totalPesawas: number = sales.reduce(
    (acc: number, s: CreditSale) => acc + (s.amount_pesawas ?? 0),
    0,
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Credit sales"
        subtitle="PORTFOLIO OVERVIEW"
        showBack={false}
      />

      <SafeScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Hero */}
        <HeroCard
          label="PORTFOLIO OVERVIEW"
          amount={totalPesawas}
          subtitle={`${sales.length} active credit sales`}
        />

        {/* Filter chips */}
        <ChipBar chips={CHIPS} active={filter} onChange={v => setFilter(v as Filter)} />

        {/* Credit cards */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No credit sales found</Text>
          </View>
        ) : (
          filtered.map((sale: CreditSale) => (
            <Pressable
              key={sale.id}
              style={styles.creditCard}
              onPress={() => router.push({ pathname: '/(main)/credit-detail', params: { id: sale.id } })}
            >
              <View style={styles.creditCardLeft}>
                <Text style={styles.customerName}>{sale.customer_name}</Text>
                <Text style={styles.dueDate}>Due {formatDate(sale.due_date)}</Text>
              </View>
              <View style={styles.creditCardRight}>
                <Text style={styles.amount}>
                  GHS {(sale.amount_pesawas / 100).toFixed(2)}
                </Text>
                <View style={styles.badgeRow}>
                  <Badge
                    label={statusLabel(sale.status)}
                    variant={statusBadgeVariant(sale.status)}
                  />
                  <Text style={styles.arrow}>→</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}

        {/* Weekly collection target card */}
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>Weekly Collection Target</Text>
          <Text style={styles.targetSub}>
            Stay on track — follow up on overdue accounts
          </Text>
          <Button
            label="View Collection Logs →"
            variant="secondary"
            onPress={() => router.push('/(main)/collection-logs' as any)}
            style={styles.targetBtn}
          />
        </View>
      </SafeScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(main)/credit-new')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  emptyWrap: {
    padding: Spacing.s8, alignItems: 'center',
  },
  emptyText: { ...Typography.bodyLG, color: Colors.t2 },
  creditCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w, marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s2, borderRadius: Radius.lg,
    padding: Spacing.s4, ...Shadows.card,
  },
  creditCardLeft: { flex: 1 },
  creditCardRight: { alignItems: 'flex-end', gap: Spacing.s1 },
  customerName: { ...Typography.bodyLG, color: Colors.t },
  dueDate: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  amount: { ...Typography.titleSM, color: Colors.t },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2 },
  arrow: { ...Typography.bodyLG, color: Colors.t2 },
  targetCard: {
    margin: Spacing.s4,
    marginTop: Spacing.s3,
    backgroundColor: Colors.g,
    borderRadius: Radius.xl,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  targetTitle: { ...Typography.titleSM, color: Colors.w, marginBottom: Spacing.s1 },
  targetSub: { ...Typography.bodySM, color: 'rgba(255,255,255,0.75)', marginBottom: Spacing.s3 },
  targetBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 0,
    marginVertical: 0,
  },
  fab: {
    position: 'absolute', right: Spacing.s5, bottom: 100,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.g,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.fab,
  },
  fabIcon: { fontSize: 26, color: Colors.w, lineHeight: 30, marginTop: -2 },
});
