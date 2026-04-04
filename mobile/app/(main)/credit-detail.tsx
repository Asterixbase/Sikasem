import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creditApi } from '@/api';
import {
  ScreenHeader, SafeScrollView, Badge, Button,
  LoadingState, ErrorState,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { fmtDateLong } from '@/utils/date';

type CreditStatus = 'paid' | 'written_off' | 'overdue' | 'pending' | 'due_tomorrow';

function statusBadgeVariant(status: string): 'red' | 'amber' | 'blue' | 'green' {
  if (status === 'overdue' || status === 'due_tomorrow') return 'red';
  if (status === 'pending') return 'blue';
  if (status === 'paid') return 'green';
  return 'blue';
}

function statusLabel(status: string): string {
  return status.replace('_', ' ').toUpperCase();
}

export default function CreditDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['credit-detail', id],
    queryFn: () => creditApi.getById(id).then(r => r.data),
    enabled: !!id,
  });

  const patchMutation = useMutation({
    mutationFn: (status: 'paid' | 'written_off' | 'overdue') =>
      creditApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['credit-list'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.detail ?? 'Action failed'),
  });

  const momoMutation = useMutation({
    mutationFn: () => creditApi.momoRequest(id),
    onSuccess: () => Alert.alert('Sent', 'MoMo request resent successfully'),
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.detail ?? 'Could not resend'),
  });

  if (isLoading) return <LoadingState message="Loading credit details…" />;
  if (error || !data) return <ErrorState message="Could not load credit details" onRetry={refetch} />;

  const sale = data;
  const amountPesawas = sale.amount_pesawas ?? 0;

  const handleMarkPaid = () => {
    Alert.alert('Mark as Paid', 'Confirm this credit has been repaid?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => patchMutation.mutate('paid') },
    ]);
  };

  const handleWriteOff = () => {
    Alert.alert(
      'Write Off',
      'Are you sure you want to write off this credit? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Write Off',
          style: 'destructive',
          onPress: () => patchMutation.mutate('written_off'),
        },
      ],
    );
  };

  const handleSendWA = () => {
    router.push({
      pathname: '/(main)/whatsapp',
      params: {
        sale_id: id,
        customer_name: sale.customer_name,
        amount_pesawas: String(amountPesawas),
        due_date: sale.due_date,
      },
    });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={sale.customer_name ?? 'Credit Detail'}
        subtitle="CREDIT DETAIL"
        onBack={() => router.back()}
      />

      <SafeScrollView>
        {/* Status badge */}
        <View style={styles.statusSection}>
          <Badge
            label={statusLabel(sale.status ?? 'pending')}
            variant={statusBadgeVariant(sale.status ?? 'pending')}
          />
        </View>

        {/* Details card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CREDIT DETAILS</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={[styles.detailValue, styles.detailValueGreen]}>
              GHS {(amountPesawas / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date</Text>
            <Text style={styles.detailValue}>
              {sale.due_date ? fmtDateLong(sale.due_date) : '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>MoMo Phone</Text>
            <Text style={styles.detailValue}>{sale.momo_phone ?? '—'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID Type</Text>
            <Text style={styles.detailValue}>
              {sale.id_type
                ? sale.id_type.replace('_', ' ').toUpperCase()
                : '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>
              {sale.created_at ? fmtDateLong(sale.created_at) : '—'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button
            label="Resend MoMo Request"
            variant="primary"
            loading={momoMutation.isPending}
            onPress={() => momoMutation.mutate()}
          />
          <Button
            label="Send WA Reminder"
            variant="whatsapp"
            onPress={handleSendWA}
          />
          <Button
            label="Mark as Paid"
            variant="primary"
            loading={patchMutation.isPending}
            onPress={handleMarkPaid}
          />
          <Button
            label="Write Off"
            variant="danger"
            loading={patchMutation.isPending}
            onPress={handleWriteOff}
          />
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  statusSection: {
    paddingHorizontal: Spacing.s4,
    paddingTop: Spacing.s4,
    paddingBottom: Spacing.s2,
  },
  card: {
    margin: Spacing.s4,
    marginTop: 0,
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.label, color: Colors.t2,
    marginBottom: Spacing.s4,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: Spacing.s3,
  },
  detailLabel: { ...Typography.bodySM, color: Colors.t2 },
  detailValue: { ...Typography.bodyLG, color: Colors.t },
  detailValueGreen: { color: Colors.g, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.gy2 },
  actionsSection: { marginTop: Spacing.s2 },
});
