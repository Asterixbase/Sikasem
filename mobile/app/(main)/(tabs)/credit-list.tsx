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
import { fmtDateLong } from '@/utils/date';
import { useThemePalette } from '@/store/theme';

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

function riskFromStatus(status: string): { emoji: string; label: string; color: string } | null {
  if (status === 'overdue') return { emoji: '🔴', label: 'HIGH RISK', color: Colors.r };
  if (status === 'due_tomorrow') return { emoji: '🟡', label: 'DUE SOON', color: Colors.a };
  return null;
}

function statusLabel(status: string): string {
  if (status === 'overdue') return 'OVERDUE';
  if (status === 'due_tomorrow') return 'DUE TOMORROW';
  if (status === 'pending') return 'PENDING';
  if (status === 'paid') return 'PAID';
  return status.toUpperCase();
}

export default function CreditListScreen() {
  const theme = useThemePalette();
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
          filtered.map((sale: CreditSale) => {
            const initials = sale.customer_name
              .split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
            return (
              <Pressable
                key={sale.id}
                style={styles.creditCard}
                onPress={() => router.push({ pathname: '/(main)/credit-detail', params: { id: sale.id } })}
              >
                {/* Avatar */}
                <View style={[
                  styles.avatar,
                  sale.status === 'overdue' ? styles.avatarRed
                    : sale.status === 'due_tomorrow' ? styles.avatarAmber
                    : styles.avatarBlue,
                ]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.customerName}>{sale.customer_name}</Text>
                    <Text style={styles.amount}>GHS {(sale.amount_pesawas / 100).toFixed(2)}</Text>
                  </View>
                  <View style={styles.cardBottomRow}>
                    <View>
                      <Text style={styles.dueDateLabel}>DUE DATE</Text>
                      <Text style={styles.dueDate}>{fmtDateLong(sale.due_date)}</Text>
                    </View>
                    <View style={styles.badgeRow}>
                      {riskFromStatus(sale.status) && (
                        <View style={[styles.riskPill, { backgroundColor: riskFromStatus(sale.status)!.color + '22' }]}>
                          <Text style={styles.riskEmoji}>{riskFromStatus(sale.status)!.emoji}</Text>
                          <Text style={[styles.riskLabel, { color: riskFromStatus(sale.status)!.color }]}>
                            {riskFromStatus(sale.status)!.label}
                          </Text>
                        </View>
                      )}
                      <Badge label={statusLabel(sale.status)} variant={statusBadgeVariant(sale.status)} />
                      <Text style={[styles.details, { color: theme.primary }]}>Details →</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

        {/* Weekly collection target card */}
        <View style={[styles.targetCard, { backgroundColor: theme.primary }]}>
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
        style={[styles.fab, { backgroundColor: theme.primary }]}
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
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.s3,
    backgroundColor: Colors.w, marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s2, borderRadius: Radius.lg,
    padding: Spacing.s4, ...Shadows.card,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  avatarRed:   { backgroundColor: Colors.r },
  avatarAmber: { backgroundColor: Colors.a },
  avatarBlue:  { backgroundColor: Colors.b },
  avatarText: { ...Typography.titleSM, color: Colors.t, fontWeight: '700' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: Spacing.s2 },
  customerName: { ...Typography.bodyMD, color: Colors.t, fontWeight: '600', flex: 1 },
  dueDateLabel: { ...Typography.micro, color: Colors.t2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dueDate: { ...Typography.bodySM, color: Colors.t, fontWeight: '500' },
  amount: { ...Typography.titleSM, color: Colors.t, marginLeft: Spacing.s2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2, flexWrap: 'wrap' },
  riskPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 3,
  },
  riskEmoji: { fontSize: 10 },
  riskLabel: { ...Typography.micro, fontWeight: '700', letterSpacing: 0.3 },
  details: { ...Typography.bodyMD, color: Colors.g, fontWeight: '600' },
  targetCard: {
    margin: Spacing.s4,
    marginTop: Spacing.s3,
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
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.fab,
  },
  fabIcon: { fontSize: 26, color: Colors.w, lineHeight: 30, marginTop: -2 },
});
