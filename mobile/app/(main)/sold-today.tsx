import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, ChipBar, LoadingState, Badge } from '@/components';
import { screenPad } from '@/utils/layout';

export default function SoldTodayScreen() {
  const [sort, setSort] = useState<'rev' | 'units' | 'margin'>('rev');
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sold-today', sort],
    queryFn: () => dashboardApi.soldToday(sort).then(r => r.data),
    staleTime: 60_000,
  });

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader
        title="Sold Today"
        subtitle={data ? `GHS ${(data.total_revenue_pesawas / 100).toFixed(2)} total` : ''}
      />
      <ChipBar
        chips={[
          { label: 'By Revenue', value: 'rev' },
          { label: 'By Units', value: 'units' },
          { label: 'By Margin', value: 'margin' },
        ]}
        active={sort}
        onChange={v => setSort(v as any)}
      />
      {isLoading && !data ? <LoadingState /> : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={i => i.product_id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={[styles.row, index === 0 && styles.rowFirst]}>
              {/* Rank number */}
              <Text style={styles.rank}>#{index + 1}</Text>

              {/* Emoji */}
              <Text style={styles.emoji}>{item.emoji}</Text>

              {/* Product info */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.sub}>
                  {item.units_sold} units · {item.transactions} txn{item.transactions !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Revenue + margin */}
              <View style={styles.right}>
                <Text style={styles.rev}>GHS {(item.revenue_pesawas / 100).toFixed(2)}</Text>
                <Badge
                  label={`${item.margin_pct.toFixed(1)}%`}
                  variant={item.margin_pct >= 35 ? 'green' : item.margin_pct >= 22 ? 'amber' : 'red'}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No sales recorded today</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  list: { paddingHorizontal: screenPad, paddingTop: Spacing.s2, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w,
    borderRadius: Radius.lg,
    padding: Spacing.s3,
    marginBottom: Spacing.s2,
    gap: Spacing.s2,
    ...Shadows.card,
  },
  rowFirst: {},
  rank: { ...Typography.bodySM, color: Colors.t2, width: 24, textAlign: 'center', fontWeight: '700' },
  emoji: { fontSize: 22 },
  info: { flex: 1 },
  name: { ...Typography.bodyLG, color: Colors.t },
  sub: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  rev: { ...Typography.bodyLG, color: Colors.t, fontWeight: '700' },
  empty: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyLG, color: Colors.t2 },
});
