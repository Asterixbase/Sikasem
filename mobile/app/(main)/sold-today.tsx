import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, ChipBar, LoadingState, Badge } from '@/components';

export default function SoldTodayScreen() {
  const [sort, setSort] = useState<'rev' | 'units' | 'margin'>('rev');
  const { data, isLoading } = useQuery({
    queryKey: ['sold-today', sort],
    queryFn: () => dashboardApi.soldToday(sort).then(r => r.data),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Sold Today" subtitle={data ? `GHS ${(data.total_revenue_pesawas/100).toFixed(2)}` : ''} />
      <ChipBar
        chips={[{label:'By Revenue',value:'rev'},{label:'By Units',value:'units'},{label:'By Margin',value:'margin'}]}
        active={sort} onChange={v => setSort(v as any)}
      />
      {isLoading ? <LoadingState /> : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={i => i.product_id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.units_sold} units · {item.transactions} txns</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rev}>GHS {(item.revenue_pesawas/100).toFixed(2)}</Text>
                <Badge
                  label={`${item.margin_pct.toFixed(1)}%`}
                  variant={item.margin_pct >= 35 ? 'green' : item.margin_pct >= 22 ? 'amber' : 'red'}
                />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w, padding: Spacing.s3,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  emoji: { fontSize: 24, marginRight: Spacing.s3 },
  name: { ...Typography.bodyLG, color: Colors.t },
  sub: { ...Typography.bodySM, color: Colors.t2 },
  rev: { ...Typography.bodyLG, color: Colors.t },
});
