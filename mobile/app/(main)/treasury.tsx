import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { treasuryApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader, SafeScrollView, HeroCard,
  Button, Badge, LoadingState, ErrorState, RoleGate,
} from '@/components';

interface Activity {
  id: string;
  type: 'collection' | 'pending' | 'payout';
  description: string;
  amount_pesawas: number;
  time: string;
}

function activityIcon(type: Activity['type']): string {
  if (type === 'collection') return '💚';
  if (type === 'pending') return '🟡';
  return '🔴';
}

function activityBadgeVariant(type: Activity['type']): 'green' | 'amber' | 'red' {
  if (type === 'collection') return 'green';
  if (type === 'pending') return 'amber';
  return 'red';
}

function TreasuryContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['treasury-balance'],
    queryFn: () => treasuryApi.balance().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading treasury…" />;
  if (error) return <ErrorState message="Could not load treasury" />;

  const d = data ?? {};
  const total: number = d.total_pesawas ?? 0;
  const available: number = d.available_payout_pesawas ?? 0;
  const momo: number = d.momo_collections_pesawas ?? 0;
  const todayDelta: number = d.today_change_pesawas ?? 0;
  const activity: Activity[] = d.recent_activity ?? [];

  return (
    <SafeScrollView>
      <HeroCard
        label="TOTAL TREASURY BALANCE"
        amount={total}
        subtitle={`+GHS ${(todayDelta / 100).toFixed(2)} TODAY`}
      />

      <View style={styles.tiles}>
        <View style={[styles.metricTile, styles.greenTile]}>
          <Text style={styles.tileLabel}>Available Payout</Text>
          <Text style={styles.tileAmount}>GHS {(available / 100).toFixed(2)}</Text>
        </View>
        <View style={[styles.metricTile, styles.blueTile]}>
          <Text style={[styles.tileLabel, { color: Colors.bt }]}>MoMo Collections</Text>
          <Text style={[styles.tileAmount, { color: Colors.bt }]}>GHS {(momo / 100).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <Button
          label="Payout Funds"
          variant="primary"
          style={styles.halfBtn}
          onPress={() => router.push('/(main)/momo-payout')}
        />
        <Button
          label="View Logs"
          variant="secondary"
          style={styles.halfBtn}
          onPress={() => router.push('/(main)/payout-history')}
        />
      </View>

      <Text style={styles.sectionHeader}>RECENT ACTIVITY</Text>
      <View style={styles.activityList}>
        {activity.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No activity yet</Text>
          </View>
        ) : activity.map((act, idx) => (
          <View key={act.id} style={[styles.activityRow, idx === activity.length - 1 && styles.noBorder]}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>{activityIcon(act.type)}</Text>
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityDesc}>{act.description}</Text>
              <Text style={styles.activityTime}>{act.time}</Text>
            </View>
            <View style={styles.activityRight}>
              <Text style={[
                styles.activityAmount,
                { color: act.amount_pesawas >= 0 ? Colors.g2 : Colors.rt },
              ]}>
                {act.amount_pesawas >= 0 ? '+' : ''}GHS {(Math.abs(act.amount_pesawas) / 100).toFixed(2)}
              </Text>
              <Badge
                label={act.type.toUpperCase()}
                variant={activityBadgeVariant(act.type)}
              />
            </View>
          </View>
        ))}
      </View>
    </SafeScrollView>
  );
}

export default function TreasuryScreen() {
  return (
    <View style={styles.root}>
      <ScreenHeader title="TREASURY" showBack={false} />
      <RoleGate
        allowed={['owner']}
        feature="Treasury"
        description="The Treasury shows your shop's MoMo collections, available balance, and lets you send payouts. Only the shop owner can access this."
      >
        <TreasuryContent />
      </RoleGate>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  tiles: { flexDirection: 'row', paddingHorizontal: Spacing.s4, gap: 8 },
  metricTile: { flex: 1, borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card },
  greenTile: { backgroundColor: Colors.gl },
  blueTile:  { backgroundColor: Colors.b },
  tileLabel:  { ...Typography.label, color: Colors.g2, marginBottom: 4 },
  tileAmount: { ...Typography.titleMD, color: Colors.g2 },
  btnRow: { flexDirection: 'row', paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, gap: 8 },
  halfBtn: { flex: 1, marginHorizontal: 0 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  activityList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card, marginBottom: Spacing.s4,
  },
  emptyRow: { padding: Spacing.s4, alignItems: 'center' },
  emptyText: { ...Typography.bodyMD, color: Colors.t2 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.s3,
  },
  iconText: { fontSize: 18 },
  activityInfo: { flex: 1, marginRight: 8 },
  activityDesc: { ...Typography.bodyLG, color: Colors.t },
  activityTime: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityAmount: { ...Typography.bodyLG, fontWeight: '700' },
});
