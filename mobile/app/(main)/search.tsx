import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList,
  Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, ChipBar, Badge } from '@/components';
import { fmtDate, fmtTime } from '@/utils/date';
import { useThemePalette } from '@/store/theme';

const TYPE_CHIPS = [
  { label: 'All',      value: 'all' },
  { label: 'Sales',    value: 'sales' },
  { label: 'Stock-In', value: 'stock-in' },
  { label: 'Payouts',  value: 'payouts' },
  { label: 'Credits',  value: 'credits' },
];

const TYPE_ICONS: Record<string, string> = {
  sale:   '💰',
  credit: '💳',
  payout: '🏦',
  'stock-in': '📦',
};

const STATUS_VARIANT: Record<string, 'green' | 'amber' | 'red' | 'blue'> = {
  completed: 'green',
  success:   'green',
  paid:      'green',
  pending:   'amber',
  overdue:   'red',
  failed:    'red',
};

export default function SearchScreen() {
  const theme = useThemePalette();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [type, setType] = useState('all');
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQChange = (text: string) => {
    setQ(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(text), 300);
  };

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQ, type],
    queryFn: () => salesApi.search({ q: debouncedQ, type }).then(r => r.data),
    enabled: debouncedQ.trim().length > 0,
    staleTime: 30_000,
  });

  const results = data?.results ?? [];
  const hasQuery = debouncedQ.trim().length > 0;
  const noResults = hasQuery && !isFetching && results.length === 0;

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Search Transactions" />

      {/* Search input */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { borderColor: theme.primary }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search by product, reference…"
            value={q}
            onChangeText={handleQChange}
            placeholderTextColor={Colors.t3}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => { setQ(''); setDebouncedQ(''); }} hitSlop={8}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ChipBar chips={TYPE_CHIPS} active={type} onChange={setType} />

      {/* Loading */}
      {isFetching && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={i => i.id}
        contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => (
          <Pressable style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Text style={styles.rowIcon}>{TYPE_ICONS[item.type] ?? '💰'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.desc}>{item.description}</Text>
              <Text style={styles.date}>
                {fmtDate(item.date)} · {fmtTime(item.date)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.amt}>GHS {(item.amount_pesawas / 100).toFixed(2)}</Text>
              <Badge
                label={item.status ?? 'completed'}
                variant={STATUS_VARIANT[item.status] ?? 'blue'}
              />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !isFetching ? (
            <View style={styles.emptyWrap}>
              {noResults ? (
                <>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>No results for "{debouncedQ}"</Text>
                  <Text style={styles.emptyHint}>
                    Try searching by product name, sale reference, or customer name.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>Search transactions</Text>
                  <Text style={styles.emptyHint}>
                    Type a product name (e.g. "Indomie") or sale reference to find transactions.
                  </Text>
                </>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },

  searchWrap: { paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s3 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    borderWidth: 1.5, paddingHorizontal: Spacing.s3, paddingVertical: 10,
    ...Shadows.card,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, ...Typography.bodyLG, color: Colors.t, padding: 0 },
  clearIcon:   { fontSize: 14, color: Colors.t3, paddingHorizontal: 4 },

  loadingWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s2,
  },
  loadingText: { ...Typography.bodySM, color: Colors.t2 },

  listContent: { paddingBottom: Spacing.s8 },
  emptyContainer: { flex: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    backgroundColor: Colors.w,
    paddingVertical: Spacing.s3, paddingHorizontal: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  rowIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
  },
  rowIcon: { fontSize: 18 },
  desc: { ...Typography.bodyMD, color: Colors.t, fontWeight: '600' },
  date: { ...Typography.bodySM, color: Colors.t2, marginTop: 1 },
  amt:  { ...Typography.bodyMD, color: Colors.t, fontWeight: '700' },

  emptyWrap: {
    alignItems: 'center', padding: Spacing.s8, paddingTop: 60,
  },
  emptyIcon:  { fontSize: 40, marginBottom: Spacing.s4 },
  emptyTitle: { ...Typography.titleSM, color: Colors.t, marginBottom: Spacing.s2 },
  emptyHint:  { ...Typography.bodyMD, color: Colors.t2, textAlign: 'center', lineHeight: 22 },
});
