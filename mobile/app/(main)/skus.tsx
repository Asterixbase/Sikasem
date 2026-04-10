import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, LoadingState, Button, Badge } from '@/components';

// ── All-products list (Total SKUs drilldown) ─────────────────────────────────
function ProductListView() {
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsApi.getProducts().then(r => r.data),
    staleTime: 60_000,
  });

  // Backend may return { products: [...] } or a plain array
  const rawProducts: any[] = Array.isArray(data)
    ? data
    : (data as any)?.products ?? (data as any)?.items ?? [];

  const filtered = q.trim()
    ? rawProducts.filter(p => p.name?.toLowerCase().includes(q.toLowerCase()))
    : rawProducts;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="All Products" subtitle={`${rawProducts.length} SKUs`} />

      <View style={listStyles.searchWrap}>
        <View style={listStyles.searchBox}>
          <Text style={listStyles.searchIcon}>🔍</Text>
          <TextInput
            style={listStyles.searchInput}
            placeholder="Search products…"
            placeholderTextColor={Colors.t2}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={listStyles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <LoadingState message="Loading products…" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.product_id ?? p.id ?? String(p.name)}
          contentContainerStyle={listStyles.listContent}
          renderItem={({ item: p, index }) => (
            <Pressable
              style={[
                listStyles.row,
                index === 0 && listStyles.rowFirst,
                index === filtered.length - 1 && listStyles.rowLast,
              ]}
              onPress={() =>
                router.push({ pathname: '/(main)/skus', params: { id: p.product_id ?? p.id } })
              }
            >
              <Text style={listStyles.emoji}>{p.emoji ?? '📦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={listStyles.name} numberOfLines={1}>{p.name}</Text>
                <Text style={listStyles.sub} numberOfLines={1}>{p.category_breadcrumb ?? ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={listStyles.stock}>{p.current_stock} units</Text>
                <Badge
                  label={`${(p.margin_pct ?? 0).toFixed(1)}%`}
                  variant={
                    (p.margin_pct ?? 0) >= 30 ? 'green'
                    : (p.margin_pct ?? 0) >= 15 ? 'amber'
                    : 'red'
                  }
                />
              </View>
              <Text style={listStyles.arrow}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={listStyles.empty}>
              <Text style={listStyles.emptyText}>
                {q.trim() ? `No products matching "${q}"` : 'No products yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Single product detail ────────────────────────────────────────────────────
export default function SkusScreen() {
  const { id, barcode } = useLocalSearchParams<{ id?: string; barcode?: string }>();

  // Route from "Total SKUs" tile sends id=all — show the full product list
  if (!id || id === 'all') return <ProductListView />;

  const queryFn = barcode
    ? () => productsApi.getByBarcode(barcode).then(r => r.data)
    : () => productsApi.getById(id).then(r => r.data);

  const { data: p, isLoading } = useQuery({
    queryKey: ['product', id ?? barcode],
    queryFn,
    enabled: !!(id || barcode),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (!p) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Product not found" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...Typography.bodyLG, color: Colors.t2 }}>
          This product could not be loaded.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.s4 }}>
          <Text style={{ ...Typography.bodyLG, color: Colors.g }}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title={p.name} />
      <ScrollView>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.emoji}>{p.emoji}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.breadcrumb}>{p.category_breadcrumb}</Text>
          <View style={styles.tags}>
            <Badge
              label={`${p.current_stock} in stock`}
              variant={p.urgency === 'critical' ? 'red' : p.urgency === 'high' ? 'amber' : 'green'}
            />
            <Badge
              label={p.urgency.toUpperCase()}
              variant={p.urgency === 'critical' ? 'red' : 'amber'}
            />
          </View>
        </View>

        {/* Analysis */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>INVENTORY ANALYSIS</Text>
          <Text style={styles.stat}>
            {p.current_stock} units · {p.daily_velocity.toFixed(1)}/day velocity
          </Text>
        </View>

        {/* Margin */}
        <View style={[styles.card, { backgroundColor: Colors.g }]}>
          <Text style={[styles.cardLabel, { color: 'rgba(255,255,255,0.7)' }]}>MARGIN</Text>
          <Text style={[styles.stat, { color: Colors.w, fontSize: 28, fontWeight: '900' }]}>
            {p.margin_pct.toFixed(1)}%
          </Text>
        </View>

        {/* Prices */}
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.cardLabel}>BUY PRICE</Text>
              <Text style={styles.price}>GHS {(p.buy_price_pesawas / 100).toFixed(2)}</Text>
            </View>
            <View>
              <Text style={styles.cardLabel}>SELL PRICE</Text>
              <Text style={[styles.price, { color: Colors.g }]}>
                GHS {(p.sell_price_pesawas / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Supplier history */}
        {p.supplier_history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SUPPLIER HISTORY</Text>
            {p.supplier_history.map((s, i) => (
              <View key={i} style={styles.supRow}>
                <Text style={styles.supName}>{s.name}</Text>
                <Text style={styles.supDate}>{s.date}</Text>
                <Text style={styles.supPrice}>GHS {(s.unit_cost_pesawas / 100).toFixed(2)}</Text>
                {s.best && <Badge label="BEST" variant="green" />}
              </View>
            ))}
          </View>
        )}

        <Button
          label="Adjust Inventory"
          variant="secondary"
          onPress={() => router.push({ pathname: '/(main)/inv-adjust', params: { id: p.product_id } })}
        />
        <Button label="View Logs" variant="secondary" onPress={() => router.push('/(main)/inv-logs')} />
        <Button label="Inventory Audit" variant="secondary" onPress={() => router.push('/(main)/inv-audit')} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Product list styles ──────────────────────────────────────────────────────
const listStyles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s3 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.s3, paddingVertical: 10,
    ...Shadows.card,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, ...Typography.bodyLG, color: Colors.t, padding: 0 },
  clearIcon: { fontSize: 14, color: Colors.t3, paddingHorizontal: 4 },
  listContent: { paddingHorizontal: Spacing.s4, paddingBottom: 40, paddingTop: Spacing.s1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    backgroundColor: Colors.w, padding: Spacing.s4,
    marginBottom: 1,
  },
  rowFirst: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  rowLast: { borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg, marginBottom: 0 },
  emoji: { fontSize: 22 },
  name: { ...Typography.bodyLG, color: Colors.t, fontWeight: '600' },
  sub: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  stock: { ...Typography.bodySM, color: Colors.t, fontWeight: '600' },
  arrow: { fontSize: 16, color: Colors.t2 },
  empty: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyMD, color: Colors.t2 },
});

// ── Single product detail styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.w, padding: Spacing.s6,
    alignItems: 'center', marginBottom: 8,
  },
  emoji: { fontSize: 56, marginBottom: 8 },
  name: { ...Typography.titleLG, color: Colors.t },
  breadcrumb: { ...Typography.bodySM, color: Colors.t2, marginTop: 4 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 8 },
  card: {
    backgroundColor: Colors.w,
    margin: Spacing.s4, marginTop: 0, marginBottom: 8,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  cardLabel: { ...Typography.label, color: Colors.t2, marginBottom: 4 },
  stat: { ...Typography.titleMD, color: Colors.t },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  price: { ...Typography.titleMD, color: Colors.t, marginTop: 4 },
  supRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  supName: { ...Typography.bodyMD, color: Colors.t, flex: 1 },
  supDate: { ...Typography.bodySM, color: Colors.t2 },
  supPrice: { ...Typography.bodyMD, color: Colors.t },
});
