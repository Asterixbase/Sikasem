import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { Button } from '@/components';
import { useThemePalette } from '@/store/theme';

export default function SaleOkScreen() {
  const theme = useThemePalette();
  const { saleId, offline } = useLocalSearchParams<{ saleId: string; offline?: string }>();
  const isOffline = offline === '1';
  const [phone, setPhone] = useState('');

  const { data: saleData } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => salesApi.getById(saleId).then(r => r.data),
    enabled: !!saleId && !isOffline,
    staleTime: Infinity,
  });

  const buildReceiptMsg = () => {
    if (!saleData) return '';
    const METHOD_LABELS: Record<string, string> = { cash: 'Cash', momo: 'MoMo', credit: 'Credit' };
    const lines = saleData.items.map(
      item => `• ${item.emoji} ${item.name} x${item.quantity} — GHS ${(item.subtotal_pesawas / 100).toFixed(2)}`
    );
    const total = (saleData.total_pesawas / 100).toFixed(2);
    const method = METHOD_LABELS[saleData.payment_method] ?? saleData.payment_method;
    return [
      `🧾 *Receipt from Sikasem*`,
      `Ref: ${saleData.reference}`,
      ``,
      ...lines,
      ``,
      `*Total: GHS ${total}* (${method})`,
      ``,
      `Thank you for your purchase! 🙏`,
    ].join('\n');
  };

  const handleSendReceipt = () => {
    const msg = buildReceiptMsg();
    if (!msg) return;

    // Format phone: strip spaces/dashes, convert 0XX → 233XX for Ghana
    let e164 = phone.replace(/[\s\-()]/g, '');
    if (e164.startsWith('0') && e164.length === 10) {
      e164 = '233' + e164.slice(1);
    } else if (e164.startsWith('+')) {
      e164 = e164.slice(1);
    }

    // With a number → direct chat; without → contact picker
    const waUrl = e164.length >= 9
      ? `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    Linking.openURL(waUrl);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.center}>
          <View style={[styles.circle, isOffline && styles.circleOffline]}>
            <Text style={{ fontSize: 40 }}>{isOffline ? '📦' : '✓'}</Text>
          </View>
          <Text style={[styles.title, { color: isOffline ? Colors.t : theme.primary }]}>
            {isOffline ? 'Sale queued!' : 'Sale confirmed!'}
          </Text>
          <Text style={styles.sub}>
            {isOffline
              ? 'Saved offline — will sync when connected'
              : 'Stock updated automatically'}
          </Text>
          {saleId && !isOffline ? (
            <Text style={styles.ref}>Ref: {saleData?.reference ?? saleId.slice(0, 8)}</Text>
          ) : null}

          {/* WhatsApp Receipt */}
          {saleData && !isOffline && (
            <View style={styles.waSection}>
              <Text style={styles.waLabel}>SEND RECEIPT VIA WHATSAPP</Text>
              <View style={styles.waInputRow}>
                <TextInput
                  style={[styles.waInput, { borderColor: phone ? theme.primary : Colors.gy2 }]}
                  placeholder="Customer phone (optional)"
                  placeholderTextColor={Colors.t3}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
                <Pressable
                  style={[styles.waSendBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSendReceipt}
                >
                  <Text style={styles.waSendIcon}>📱</Text>
                </Pressable>
              </View>
              <Text style={styles.waHint}>
                {phone.trim()
                  ? 'Will open WhatsApp directly to this number'
                  : 'Leave blank to pick a contact in WhatsApp'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Button label="New Sale" variant="secondary" onPress={() => router.replace('/(main)/sale')} />
          <Button label="Done" onPress={() => router.replace('/(main)/dash')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.w },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.s6 },
  circle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.gl, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  circleOffline: { backgroundColor: Colors.a },
  title: { ...Typography.titleLG },
  sub: { ...Typography.bodyMD, color: Colors.t2, marginTop: 8, textAlign: 'center' },
  ref: { ...Typography.badge, color: Colors.t2, marginTop: 12 },

  waSection: {
    width: '100%', marginTop: 28,
  },
  waLabel: { ...Typography.label, color: Colors.t2, marginBottom: Spacing.s2 },
  waInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waInput: {
    flex: 1, borderWidth: 1.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.s3, paddingVertical: 11,
    ...Typography.bodyMD, color: Colors.t,
  },
  waSendBtn: {
    width: 46, height: 46, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  waSendIcon: { fontSize: 22 },
  waHint: { ...Typography.bodySM, color: Colors.t3, marginTop: 6 },

  footer: { padding: Spacing.s4, gap: 8 },
});
