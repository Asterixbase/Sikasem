import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, Pressable, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi } from '@/api';
import { useCartStore } from '@/store/cart';
import { useOfflineQueue, isNetworkError } from '@/store/offlineQueue';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { QuantityStepper, Button } from '@/components';
import { useThemePalette } from '@/store/theme';

const PAYMENT_METHODS = [
  { key: 'cash',   label: 'Cash' },
  { key: 'momo',   label: 'MoMo' },
  { key: 'credit', label: 'Credit' },
] as const;

export default function SaleScreen() {
  const theme = useThemePalette();
  const { items, paymentMethod, setPaymentMethod, setQty, removeItem, totalPesawas, clear, addItem } = useCartStore();
  const { enqueue } = useOfflineQueue();
  const [loading, setLoading]     = useState(false);
  const [momoPhone, setMomoPhone] = useState('');
  const [searchQ, setSearchQ]     = useState('');

  // Product search / quick-add (updates live as user types)
  const { data: productsData } = useQuery({
    queryKey: ['quickAddProducts', searchQ],
    queryFn: () => productsApi.getProducts({ limit: 20, q: searchQ }).then(r => r.data),
    staleTime: 30_000,
  });
  const quickProducts = (productsData?.items ?? productsData ?? []).slice(0, 20);

  const handleSale = async () => {
    if (items.length === 0) { Alert.alert('Cart empty', 'Add items first'); return; }
    setLoading(true);
    try {
      const saleItems = items.map(i => ({
        product_id: i.product_id, quantity: i.quantity, unit_price_pesawas: i.unit_price_pesawas,
      }));
      const res = await salesApi.create({ items: saleItems, payment_method: paymentMethod, total_pesawas: totalPesawas() });
      if (paymentMethod === 'momo' && momoPhone) {
        await salesApi.collectMomo({ amount_pesawas: totalPesawas(), phone: momoPhone, reference: res.data.reference });
      }
      if (paymentMethod === 'credit') {
        clear(); router.push('/(main)/credit-new'); return;
      }
      clear();
      router.push({ pathname: '/(main)/sale-ok', params: { saleId: res.data.sale_id } });
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        const saleItems = items.map(i => ({
          product_id: i.product_id, quantity: i.quantity, unit_price_pesawas: i.unit_price_pesawas,
        }));
        enqueue({ items: saleItems, payment_method: paymentMethod, total_pesawas: totalPesawas() });
        clear();
        router.push({ pathname: '/(main)/sale-ok', params: { saleId: 'offline', offline: '1' } });
      } else {
        const detail = (err as any)?.response?.data?.detail ?? (err as any)?.message ?? 'Please try again';
        Alert.alert('Sale failed', detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Quick sale</Text>
        <Pressable onPress={() => router.push('/(main)/scan')} hitSlop={8}>
          <Text style={{ fontSize: 20 }}>📷</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll}>
        {items.length === 0 ? (
          <View>
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyText}>Cart is empty</Text>
              <Text style={styles.emptySub}>Search or tap a product below</Text>
            </View>

            {/* Product search autocomplete */}
            <View style={styles.searchWrap}>
              <TextInput
                style={[styles.searchInput, { borderColor: searchQ ? theme.primary : Colors.gy2 }]}
                placeholder="🔍  Search products…"
                placeholderTextColor={Colors.t3}
                value={searchQ}
                onChangeText={setSearchQ}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQ.length > 0 && (
                <Pressable onPress={() => setSearchQ('')} style={styles.searchClear} hitSlop={8}>
                  <Text style={styles.searchClearText}>✕</Text>
                </Pressable>
              )}
            </View>

            {quickProducts.length > 0 && (
              <View style={styles.quickAdd}>
                <Text style={styles.quickAddLabel}>
                  {searchQ ? `RESULTS FOR "${searchQ.toUpperCase()}"` : 'QUICK ADD'}
                </Text>
                <View style={styles.quickGrid}>
                  {quickProducts.map((p: any) => (
                    <Pressable
                      key={p.id}
                      style={styles.quickItem}
                      onPress={() => addItem({
                        product_id: p.id,
                        name: p.name,
                        emoji: p.emoji ?? '📦',
                        unit_price_pesawas: p.sell_price_pesawas,
                      })}
                    >
                      <Text style={styles.quickEmoji}>{p.emoji ?? '📦'}</Text>
                      <Text style={styles.quickName} numberOfLines={2}>{p.name}</Text>
                      <Text style={[styles.quickPrice, { color: theme.primary }]}>
                        GHS {(p.sell_price_pesawas / 100).toFixed(2)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          items.map(item => (
            <View key={item.product_id} style={styles.itemRow}>
              <View style={styles.itemEmoji}>
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>GHS {(item.unit_price_pesawas / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.itemRight}>
                <QuantityStepper
                  value={item.quantity}
                  onChange={q => q === 0 ? removeItem(item.product_id) : setQty(item.product_id, q)}
                />
                <Text style={styles.itemTotal}>
                  GHS {((item.unit_price_pesawas * item.quantity) / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Add more items */}
        <Pressable style={styles.addMore} onPress={() => router.push('/(main)/search')}>
          <Text style={[styles.addMoreText, { color: theme.primary }]}>＋  Add more items</Text>
        </Pressable>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Total row */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>GHS {(totalPesawas() / 100).toFixed(2)}</Text>
        </View>

        {/* Payment method — equal segments */}
        <View style={styles.payRow}>
          {PAYMENT_METHODS.map((m, i) => (
            <Pressable
              key={m.key}
              onPress={() => setPaymentMethod(m.key)}
              style={[
                styles.payBtn,
                i === 0 && styles.payBtnFirst,
                i === PAYMENT_METHODS.length - 1 && styles.payBtnLast,
                paymentMethod === m.key && { backgroundColor: theme.bgLight },
              ]}
            >
              <Text style={[
                styles.payLabel,
                paymentMethod === m.key && { color: theme.primary, fontWeight: '700' },
              ]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* MoMo phone input */}
        {paymentMethod === 'momo' && (
          <TextInput
            style={styles.momoInput}
            placeholder="MoMo phone (0XXXXXXXXX)"
            value={momoPhone}
            onChangeText={setMomoPhone}
            keyboardType="phone-pad"
            placeholderTextColor={Colors.t3}
          />
        )}

        {/* Confirm button */}
        <Pressable
          style={[styles.confirmBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.7 }]}
          onPress={handleSale}
          disabled={loading}
        >
          <Text style={styles.confirmText}>
            {loading ? 'Processing…' : 'Confirm sale →'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.w },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.s4, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  backBtn: { marginRight: Spacing.s3 },
  backIcon: { fontSize: 20, color: Colors.t },
  headerTitle: { ...Typography.titleMD, color: Colors.t, flex: 1 },

  scroll: { flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { ...Typography.titleMD, color: Colors.t },
  emptySub:  { ...Typography.bodyMD, color: Colors.t2, marginTop: 6 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
  },
  searchInput: {
    flex: 1, borderWidth: 1.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.s3, paddingVertical: 10,
    ...Typography.bodyMD, color: Colors.t,
    backgroundColor: Colors.w,
  },
  searchClear: {
    position: 'absolute', right: Spacing.s3,
    paddingHorizontal: 6, paddingVertical: 4,
  },
  searchClearText: { fontSize: 13, color: Colors.t2 },

  quickAdd: { paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s4 },
  quickAddLabel: { ...Typography.label, color: Colors.t2, marginBottom: Spacing.s3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: {
    width: '30%', backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s3, alignItems: 'center', gap: 4, ...Shadows.card,
  },
  quickEmoji: { fontSize: 24 },
  quickName:  { ...Typography.badge, color: Colors.t, textAlign: 'center', lineHeight: 15 },
  quickPrice: { ...Typography.badge, fontWeight: '700' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.s4, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
    gap: Spacing.s3,
  },
  itemEmoji: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
  },
  itemName:  { ...Typography.bodyMD, color: Colors.t, fontWeight: '600' },
  itemPrice: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemTotal: { ...Typography.bodyMD, color: Colors.t, fontWeight: '700' },

  addMore: { paddingHorizontal: Spacing.s4, paddingVertical: 16 },
  addMoreText: { ...Typography.bodyMD, fontWeight: '600' },

  footer: {
    borderTopWidth: 1, borderTopColor: Colors.gy2,
    padding: Spacing.s4, gap: Spacing.s3,
    backgroundColor: Colors.w,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel:  { ...Typography.bodyMD, color: Colors.t2 },
  totalAmount: { ...Typography.displayMD, color: Colors.t, fontWeight: '700' },

  // Payment segments — equal width, shared border
  payRow: { flexDirection: 'row', borderWidth: 1.5, borderColor: Colors.gy2, borderRadius: Radius.md, overflow: 'hidden' },
  payBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.w,
    borderRightWidth: 1, borderRightColor: Colors.gy2,
  },
  payBtnFirst: { borderLeftWidth: 0 },
  payBtnLast:  { borderRightWidth: 0 },
  payLabel: { ...Typography.bodyMD, color: Colors.t2 },

  momoInput: {
    borderWidth: 1.5, borderColor: Colors.gy2, borderRadius: Radius.md,
    paddingHorizontal: Spacing.s3, paddingVertical: 12,
    ...Typography.bodyMD, color: Colors.t,
  },

  confirmBtn: {
    borderRadius: Radius.md,
    paddingVertical: 16, alignItems: 'center', minHeight: 52,
  },
  confirmText: { ...Typography.titleSM, color: Colors.w },
});
