import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, ChipBar, Badge } from '@/components';

export default function SearchScreen() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const { data } = useQuery({
    queryKey: ['search', q, type],
    queryFn: () => salesApi.search({ q, type }).then(r => r.data),
    enabled: q.length > 0,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Search Transactions" />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search} placeholder="Search…" value={q} onChangeText={setQ}
          placeholderTextColor={Colors.t2}
        />
      </View>
      <ChipBar
        chips={[{label:'All',value:'all'},{label:'Sales',value:'sales'},{label:'Stock-In',value:'stock-in'},{label:'Payouts',value:'payouts'},{label:'Credits',value:'credits'}]}
        active={type} onChange={setType}
      />
      <FlatList
        data={data?.results ?? []}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.desc}>{item.description}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.amt}>GHS {(item.amount_pesawas/100).toFixed(2)}</Text>
              <Badge label={item.status} variant={item.status === 'success' ? 'green' : 'red'} />
            </View>
          </View>
        )}
        ListEmptyComponent={q.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>Type to search</Text></View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: Spacing.s4 },
  search: {
    backgroundColor: Colors.w, borderRadius: Radius.sm,
    padding: 11, borderWidth: 1, borderColor: Colors.g,
    ...Typography.bodyLG, color: Colors.t,
  },
  row: {
    flexDirection: 'row', backgroundColor: Colors.w,
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  desc: { ...Typography.bodyLG, color: Colors.t },
  date: { ...Typography.bodySM, color: Colors.t2 },
  amt: { ...Typography.bodyLG, color: Colors.t },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { ...Typography.bodyMD, color: Colors.t2 },
});
