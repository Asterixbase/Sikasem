import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { treasuryApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, HeroCard, Badge, LoadingState, ErrorState, RoleGate } from '@/components';

interface Payout {
  id: string;
  name: string;
  phone: string;
  network: 'mtn' | 'telecel';
  amount_pesawas: number;
  date: string;
  time: string;
  status: 'success' | 'pending' | 'failed';
}

const MOCK_PAYOUTS: Payout[] = [
  { id: '1', name: 'Kwame Osei', phone: '+233 24 123 4567', network: 'mtn', amount_pesawas: 45000, date: '28 Mar 2026', time: '09:14 AM', status: 'success' },
  { id: '2', name: 'Ama Mensah', phone: '+233 50 987 6543', network: 'telecel', amount_pesawas: 120000, date: '27 Mar 2026', time: '02:30 PM', status: 'success' },
  { id: '3', name: 'Kofi Asante', phone: '+233 24 555 0001', network: 'mtn', amount_pesawas: 32000, date: '26 Mar 2026', time: '11:05 AM', status: 'pending' },
  { id: '4', name: 'Akua Boateng', phone: '+233 55 444 7890', network: 'telecel', amount_pesawas: 88000, date: '25 Mar 2026', time: '04:45 PM', status: 'failed' },
  { id: '5', name: 'Yaw Darko', phone: '+233 24 333 2211', network: 'mtn', amount_pesawas: 60000, date: '24 Mar 2026', time: '08:20 AM', status: 'success' },
];

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function statusBadge(status: Payout['status']) {
  if (status === 'success') return <Badge label="SUCCESS" variant="green" />;
  if (status === 'pending') return <Badge label="PENDING" variant="amber" />;
  return <Badge label="FAILED" variant="red" />;
}

function statusDot(status: Payout['status']): string {
  if (status === 'success') return Colors.g;
  if (status === 'pending') return Colors.at;
  return Colors.rt;
}

export default function PayoutHistoryScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => treasuryApi.payouts(50).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading payout history…" />;
  if (error) return <ErrorState message="Could not load payouts" />;

  const payouts: Payout[] = (data?.payouts?.length > 0 ? data.payouts : null) ?? MOCK_PAYOUTS;
  const totalPaid = payouts
    .filter(p => p.status === 'success')
    .reduce((s, p) => s + p.amount_pesawas, 0);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Payout History" />
      <RoleGate allowed={['owner']} feature="Payout History" description="Only the shop owner can view payout history.">
      <SafeScrollView>
        {/* Hero */}
        <HeroCard
          label="TOTAL PAID OUT"
          amount={totalPaid}
          subtitle="12.5% vs last month"
        />

        {/* Section header */}
        <Text style={styles.sectionHeader}>RECENT ACTIVITY — MARCH 2026</Text>

        {/* Payout rows */}
        <View style={styles.payoutList}>
          {payouts.map((payout, idx) => (
            <View key={payout.id} style={[styles.payoutRow, idx === payouts.length - 1 && styles.noBorder]}>
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(payout.name)}</Text>
              </View>
              {/* Info */}
              <View style={styles.payoutInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.payoutName}>{payout.name}</Text>
                  <View style={[styles.networkBadge, { backgroundColor: payout.network === 'mtn' ? '#FFF8E1' : Colors.b }]}>
                    <Text style={[styles.networkText, { color: payout.network === 'mtn' ? '#FFB300' : Colors.bt }]}>
                      {payout.network.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.payoutPhone}>{payout.phone}</Text>
                <Text style={styles.payoutDateTime}>{payout.date} · {payout.time}</Text>
              </View>
              {/* Amount + status */}
              <View style={styles.payoutRight}>
                <Text style={styles.payoutAmount}>GHS {(payout.amount_pesawas / 100).toFixed(2)}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusDot(payout.status) }]} />
                  {statusBadge(payout.status)}
                </View>
              </View>
            </View>
          ))}
        </View>
      </SafeScrollView>

      {/* Download FAB */}
      <Pressable style={styles.fab} onPress={() => Alert.alert('Download', 'Payout report download coming soon')}>
        <Text style={styles.fabIcon}>⬇</Text>
      </Pressable>
      </RoleGate>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  payoutList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  payoutRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.g, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.s3,
  },
  avatarText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  payoutInfo: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payoutName: { ...Typography.bodyLG, color: Colors.t },
  networkBadge: {
    borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 2,
  },
  networkText: { ...Typography.micro, fontWeight: '700' },
  payoutPhone: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  payoutDateTime: { ...Typography.bodySM, color: Colors.t2, marginTop: 1 },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  payoutAmount: { ...Typography.bodyLG, fontWeight: '700', color: Colors.t },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.gy2,
    alignItems: 'center', justifyContent: 'center', ...Shadows.fab,
  },
  fabIcon: { fontSize: 20 },
});
