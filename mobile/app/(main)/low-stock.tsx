import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, ChipBar, LoadingState, Badge } from '@/components';

const URGENCY_COLORS: Record<string, 'red' | 'amber' | 'green'> = {
  critical: 'red', high: 'amber', normal: 'green',
};

export default function LowStockScreen() {
  const [urgency, setUrgency] = useState('all');
  const { data, isLoading } = useQuery({
    queryKey: ['low-stock', urgency],
    queryFn: () => dashboardApi.lowStock(urgency as any).then(r => r.data),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Low Stock Alerts" />
      <ChipBar
        chips={[{label:'All',value:'all'},{label:'Critical',value:'critical'},{label:'High',value:'high'},{label:'Normal',value:'normal'}]}
        active={urgency} onChange={setUrgency}
      />
      {isLoading ? <LoadingState /> : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={i => i.product_id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/(main)/reorder`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.current_stock} left · {item.days_remaining}d remaining</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={item.urgency.toUpperCase()} variant={URGENCY_COLORS[item.urgency]} />
                <Text style={styles.sub}>Order {item.suggested_order_qty}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w, padding: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  name: { ...Typography.bodyLG, color: Colors.t },
  sub: { ...Typography.bodySM, color: Colors.t2 },
});
