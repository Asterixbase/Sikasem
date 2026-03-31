import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { salesApi } from '@/api';
import { useCartStore } from '@/store/cart';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, QuantityStepper, Button } from '@/components';

export default function SaleScreen() {
  const { items, paymentMethod, setPaymentMethod, setQty, removeItem, totalPesawas, clear } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [momoPhone, setMomoPhone] = useState('');

  const handleSale = async () => {
    if (items.length === 0) { Alert.alert('Cart empty', 'Add items to the cart first'); return; }
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
        clear();
        router.push('/(main)/credit-new');
        return;
      }
      clear();
      router.push({ pathname: '/(main)/sale-ok', params: { saleId: res.data.sale_id } });
    } catch {
      Alert.alert('Sale failed', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Quick Sale" right={
        <Pressable onPress={() => router.push('/(main)/scan')} hitSlop={8}>
          <Text style={{ fontSize: 22 }}>📷</Text>
        </Pressable>
      } />

      <ScrollView>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Cart is empty</Text>
            <Text style={styles.emptySub}>Scan a barcode or search to add items</Text>
          </View>
        ) : items.map(item => (
          <View key={item.product_id} style={styles.item}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>GHS {(item.unit_price_pesawas/100).toFixed(2)} each</Text>
            </View>
            <QuantityStepper value={item.quantity} onChange={q => q === 0 ? removeItem(item.product_id) : setQty(item.product_id, q)} />
          </View>
        ))}

        {/* Payment selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
          <View style={styles.payRow}>
            {(['cash','momo','credit'] as const).map(m => (
              <Pressable
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[styles.payBtn, paymentMethod === m && styles.payBtnActive]}
              >
                <Text style={[styles.payLabel, paymentMethod === m && styles.payLabelActive]}>
                  {m === 'cash' ? '💵 Cash' : m === 'momo' ? '📲 MoMo' : '💳 Credit'}
                </Text>
              </Pressable>
            ))}
          </View>
          {paymentMethod === 'momo' && (
            <TextInput
              style={styles.input} placeholder="MoMo phone number (0XXXXXXXXX)"
              value={momoPhone} onChangeText={setMomoPhone}
              keyboardType="phone-pad" placeholderTextColor={Colors.t2}
            />
          )}
        </View>
      </ScrollView>

      {/* Footer total + confirm */}
      <View style={styles.footer}>
        <Text style={styles.total}>GHS {(totalPesawas()/100).toFixed(2)}</Text>
        <Button label="Confirm Sale" onPress={handleSale} loading={loading} style={styles.confirmBtn as any} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { ...Typography.titleMD, color: Colors.t },
  emptySub: { ...Typography.bodyMD, color: Colors.t2, marginTop: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w, padding: Spacing.s3,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  itemEmoji: { fontSize: 24, marginRight: Spacing.s3 },
  itemName: { ...Typography.bodyLG, color: Colors.t },
  itemPrice: { ...Typography.bodySM, color: Colors.t2 },
  section: { padding: Spacing.s4 },
  sectionLabel: { ...Typography.label, color: Colors.t2, marginBottom: 8 },
  payRow: { flexDirection: 'row', gap: 8 },
  payBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.sm,
    backgroundColor: Colors.gy, borderWidth: 1, borderColor: Colors.gy2,
    alignItems: 'center',
  },
  payBtnActive: { backgroundColor: Colors.gl, borderColor: Colors.g },
  payLabel: { ...Typography.bodyMD, color: Colors.t2 },
  payLabelActive: { color: Colors.g, fontWeight: '700' },
  input: {
    marginTop: Spacing.s3, borderWidth: 1, borderColor: Colors.gy2,
    borderRadius: Radius.sm, padding: 11, ...Typography.bodyLG, color: Colors.t,
  },
  footer: {
    backgroundColor: Colors.w, padding: Spacing.s4,
    borderTopWidth: 1, borderTopColor: Colors.gy2,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  total: { ...Typography.displayMD, color: Colors.g, flex: 1, marginLeft: Spacing.s2 },
  confirmBtn: { flex: 1, marginHorizontal: 0, marginVertical: 0 },
});
