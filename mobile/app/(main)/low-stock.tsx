import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, ChipBar, LoadingState } from '@/components';
import { screenPad } from '@/utils/layout';

const URGENCY_COLOR: Record<string, string> = {
  critical: Colors.rt,
  high: Colors.at,
  normal: Colors.g,
};

const URGENCY_BG: Record<string, string> = {
  critical: '#FFF1F2',
  high: '#FFFBEB',
  normal: '#F0FDF4',
};

export default function LowStockScreen() {
  const [urgency, setUrgency] = useState('all');
  const { data, isLoading } = useQuery({
    queryKey: ['low-stock', urgency],
    queryFn: () => dashboardApi.lowStock(urgency as any).then(r => r.data),
    staleTime: 60_000,
  });

  const items = data?.items ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Low Stock Alerts" />
      <ChipBar
        chips={[
          { label: 'All', value: 'all' },
          { label: 'Critical', value: 'critical' },
          { label: 'High', value: 'high' },
          { label: 'Normal', value: 'normal' },
        ]}
        active={urgency}
        onChange={setUrgency}
      />

      {isLoading ? <LoadingState /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.product_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const color = URGENCY_COLOR[item.urgency] ?? Colors.g;
            const bg    = URGENCY_BG[item.urgency]    ?? '#F0FDF4';
            const stockPct = Math.min(100, Math.max(0, (item.days_remaining / 14) * 100));
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push('/(main)/reorder')}
              >
                {/* Urgency left border */}
                <View style={[styles.urgencyBar, { backgroundColor: color }]} />

                <View style={styles.rowBody}>
                  {/* Top row: name + order qty */}
                  <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.orderBadge, { backgroundColor: bg }]}>
                      <Text style={[styles.orderText, { color }]}>
                        Order {item.suggested_order_qty}
                      </Text>
                    </View>
                  </View>

                  {/* Stock info row */}
                  <View style={styles.infoRow}>
                    <Text style={styles.stockNum}>{item.current_stock} left</Text>
                    <Text style={styles.dot}> · </Text>
                    <Text style={styles.days}>
                      {item.days_remaining >= 999 ? 'No sales data' : `${item.days_remaining}d remaining`}
                    </Text>
                    <Text style={styles.dot}> · </Text>
                    <Text style={[styles.urgencyLabel, { color }]}>
                      {item.urgency.toUpperCase()}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${stockPct}%` as any, backgroundColor: color }]} />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No items match this filter</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: Spacing.s2, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.w,
    marginBottom: 1,   // hairline divider only — cards go edge-to-edge
    overflow: 'hidden',
  },
  urgencyBar: { width: 5 },
  rowBody: {
    flex: 1,
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: { ...Typography.bodyLG, color: Colors.t, flex: 1, marginRight: 8 },
  orderBadge: {
    borderRadius: Radius.xs,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  orderText: { ...Typography.micro, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.s2,
  },
  stockNum: { ...Typography.bodySM, color: Colors.t, fontWeight: '600' },
  dot: { ...Typography.bodySM, color: Colors.t2 },
  days: { ...Typography.bodySM, color: Colors.t2 },
  urgencyLabel: { ...Typography.micro, fontWeight: '700' },
  barTrack: {
    height: 5, backgroundColor: Colors.gy2,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3 },
  empty: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyLG, color: Colors.t2 },
});
