import React from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creditApi } from '@/api';
import {
  ScreenHeader, SafeScrollView, HeroCard, Badge,
  LoadingState, ErrorState,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { useThemePalette } from '@/store/theme';

// Matches GET /credit/collections CollectionItem schema
interface CollectionRow {
  id: string;              // credit_collection.id
  credit_sale_id: string;  // used for MoMo retry endpoint
  customer_id: string;
  initials: string;
  name: string;            // customer full name
  ref: string;
  network?: string;
  amount_pesawas: number;
  status: 'success' | 'pending' | 'failed';
}

function badgeVariant(status: string): 'green' | 'amber' | 'red' {
  if (status === 'success') return 'green';
  if (status === 'pending') return 'amber';
  return 'red';
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function CollectionLogsScreen() {
  const theme = useThemePalette();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['collections'],
    queryFn: () => creditApi.collections().then(r => r.data),
  });

  const retryMutation = useMutation({
    // Retry uses the credit_sale_id (not the collection record id)
    mutationFn: (credit_sale_id: string) => creditApi.momoRequest(credit_sale_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });

  if (isLoading) return <LoadingState message="Loading collection logs…" />;
  if (error) return <ErrorState message="Could not load collection logs" onRetry={refetch} />;

  // Backend returns { items: [...], current_month_total_pesawas, ... }
  const raw = data?.items ?? data?.collections ?? data;
  const collections: CollectionRow[] = Array.isArray(raw) ? raw : [];

  const collectedPesawas: number = collections
    .filter((c: CollectionRow) => c.status === 'success')
    .reduce((acc: number, c: CollectionRow) => acc + (c.amount_pesawas ?? 0), 0);

  const pendingPesawas: number = collections
    .filter((c: CollectionRow) => c.status === 'pending')
    .reduce((acc: number, c: CollectionRow) => acc + (c.amount_pesawas ?? 0), 0);

  const activeCount = collections.filter(
    (c: CollectionRow) => c.status === 'pending',
  ).length;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Collection Logs"
        subtitle="MOMO AUTO-COLLECT"
        onBack={() => router.back()}
      />

      <SafeScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Hero card */}
        <HeroCard
          label="COLLECTED"
          amount={collectedPesawas}
          subtitle={`GHS ${(pendingPesawas / 100).toFixed(2)} pending in vault · ${activeCount} Active Requests`}
        />

        {/* Quick nav row */}
        <View style={styles.navRow}>
          <Pressable
            style={styles.navBtn}
            onPress={() => router.push('/(main)/vault' as any)}
          >
            <Text style={styles.navBtnText}>🏦 View Vault</Text>
          </Pressable>
          <Pressable
            style={styles.navBtn}
            onPress={() => router.push('/(main)/momo-payout' as any)}
          >
            <Text style={styles.navBtnText}>💸 MoMo Payout</Text>
          </Pressable>
        </View>

        {/* Collection rows */}
        {collections.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No collection records found</Text>
          </View>
        ) : (
          collections.map((col: CollectionRow) => (
            <View key={col.id} style={styles.row}>
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: theme.bgLight }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>{col.initials || getInitials(col.name)}</Text>
              </View>

              {/* Name + ref */}
              <View style={styles.rowMeta}>
                <Text style={styles.rowName}>{col.name}</Text>
                {col.ref ? (
                  <Text style={styles.rowRef}>{col.ref}</Text>
                ) : null}
              </View>

              {/* Amount */}
              <Text style={styles.rowAmount}>
                GHS {(col.amount_pesawas / 100).toFixed(2)}
              </Text>

              {/* Badge */}
              <Badge label={col.status.toUpperCase()} variant={badgeVariant(col.status)} />

              {/* Retry button on failed only */}
              {col.status === 'failed' ? (
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => retryMutation.mutate(col.credit_sale_id)}
                  hitSlop={8}
                >
                  <Text style={styles.retryIcon}>↺</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  navRow: {
    flexDirection: 'row', gap: Spacing.s2,
    paddingHorizontal: Spacing.s4,
    marginBottom: Spacing.s3,
  },
  navBtn: {
    flex: 1, backgroundColor: Colors.w,
    borderRadius: Radius.md, padding: Spacing.s3,
    alignItems: 'center', ...Shadows.card,
  },
  navBtnText: { ...Typography.badge, color: Colors.t },
  emptyWrap: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyLG, color: Colors.t2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w,
    marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s2,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    gap: Spacing.s2,
    ...Shadows.card,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { ...Typography.bodyLG, fontWeight: '800' },
  rowMeta: { flex: 1 },
  rowName: { ...Typography.bodyLG, color: Colors.t },
  rowRef: { ...Typography.micro, color: Colors.t2, marginTop: 1 },
  rowAmount: { ...Typography.badge, color: Colors.t, marginRight: Spacing.s1 },
  retryBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.r,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: Spacing.s1,
  },
  retryIcon: { fontSize: 14, color: Colors.rt, fontWeight: '700' },
});
