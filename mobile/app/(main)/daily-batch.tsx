import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, LoadingState, HeroCard } from '@/components';

export default function DailyBatchScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-batch'],
    queryFn: () => salesApi.todayBatch().then(r => r.data),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Daily Sales Batch" subtitle={data?.date} />
      {isLoading ? <LoadingState /> : (
        <>
          <HeroCard label="TODAY'S TOTAL" amount={data?.total_pesawas} style={{ marginBottom: 0 }} />
          <View style={styles.breakdown}>
            {(['cash','momo','credit'] as const).map(m => (
              <View key={m} style={styles.tile}>
                <Text style={styles.tileLabel}>{m.toUpperCase()}</Text>
                <Text style={styles.tileVal}>GHS {((data?.payment_breakdown[m] ?? 0)/100).toFixed(2)}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.status, { backgroundColor: data?.status === 'balanced' ? Colors.g : Colors.rt }]}>
            <Text style={styles.statusText}>
              Batch Status: {data?.status === 'balanced' ? '✓ Balanced' : '⚠ Unbalanced'}
            </Text>
          </View>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          <FlatList
            data={data?.activity ?? []}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.time}>{item.time}</Text>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.method}>{item.method}</Text>
                <Text style={styles.amt}>GHS {(item.amount_pesawas/100).toFixed(2)}</Text>
              </View>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  breakdown: { flexDirection: 'row', paddingHorizontal: Spacing.s4, gap: 8 },
  tile: { flex: 1, backgroundColor: Colors.w, borderRadius: Radius.md, padding: Spacing.s3, alignItems: 'center' },
  tileLabel: { ...Typography.label, color: Colors.t2 },
  tileVal: { ...Typography.titleSM, color: Colors.t, marginTop: 4 },
  status: { margin: Spacing.s4, borderRadius: Radius.md, padding: Spacing.s3 },
  statusText: { ...Typography.bodyLG, color: Colors.w, textAlign: 'center' },
  sectionLabel: { ...Typography.label, color: Colors.t2, paddingHorizontal: Spacing.s4, marginTop: Spacing.s4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.w, padding: Spacing.s3,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  time: { ...Typography.bodySM, color: Colors.t2, width: 45 },
  desc: { ...Typography.bodyMD, color: Colors.t, flex: 1 },
  method: { ...Typography.badge, color: Colors.bt },
  amt: { ...Typography.bodyMD, color: Colors.t, width: 70, textAlign: 'right' },
});
