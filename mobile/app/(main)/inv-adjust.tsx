import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { inventoryApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button, FormInput } from '@/components';

type Reason = 'Damage' | 'Loss' | 'Inventory Correction' | 'Expired';

const REASONS: Reason[] = ['Damage', 'Loss', 'Inventory Correction', 'Expired'];

const REASON_MAP: Record<Reason, string> = {
  'Damage': 'damage',
  'Loss': 'loss',
  'Inventory Correction': 'correction',
  'Expired': 'expired',
};

export default function InvAdjustScreen() {
  const { product_id, product_name, current_stock, emoji } =
    useLocalSearchParams<{
      product_id: string;
      product_name?: string;
      current_stock?: string;
      emoji?: string;
    }>();

  const baseStock = parseInt(current_stock ?? '50', 10);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<Reason | null>(null);
  const [notes, setNotes] = useState('');

  const newStock = baseStock + delta;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      inventoryApi.addMovement({
        product_id: product_id ?? 'unknown',
        movement_type: 'adjustment',
        quantity: Math.abs(delta),
        adjustment_sign: delta >= 0 ? '+' : '-',
        reason: reason ? (REASON_MAP[reason] as any) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      Alert.alert('Adjusted', 'Inventory adjustment logged');
      router.push('/(main)/inv-logs');
    },
    onError: () => Alert.alert('Error', 'Could not save adjustment'),
  });

  const handleConfirm = () => {
    if (!reason) { Alert.alert('Reason required', 'Please select a reason for the adjustment'); return; }
    if (delta === 0) { Alert.alert('No change', 'Please adjust the quantity before confirming'); return; }
    mutate();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Inventory Adjustment" subtitle={product_name ?? 'Product'} />
      <SafeScrollView>
        {/* Product header */}
        <View style={styles.productHeader}>
          <Text style={styles.productEmoji}>{emoji ?? '📦'}</Text>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product_name ?? 'Unknown Product'}</Text>
            <Text style={styles.breadcrumb}>Inventory › Adjust</Text>
          </View>
        </View>

        {/* Stepper section */}
        <View style={styles.stepperCard}>
          <Text style={styles.stepperLabel}>Current Stock</Text>
          <Text style={styles.currentStock}>{baseStock} units</Text>

          {/* +/- stepper */}
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setDelta(d => d - 1)}
            >
              <Text style={styles.stepBtnTextRed}>−</Text>
            </Pressable>
            <View style={styles.deltaDisplay}>
              <Text style={[styles.deltaText, { color: delta > 0 ? Colors.g : delta < 0 ? Colors.rt : Colors.t2 }]}>
                {delta > 0 ? `+${delta}` : String(delta)}
              </Text>
            </View>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setDelta(d => d + 1)}
            >
              <Text style={styles.stepBtnTextGreen}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.previewText}>
            New stock will be: <Text style={styles.previewBold}>{newStock} units</Text>
          </Text>
        </View>

        {/* Reason chips */}
        <Text style={styles.sectionHeader}>REASON FOR ADJUSTMENT</Text>
        <View style={styles.reasonChips}>
          {REASONS.map(r => (
            <Pressable
              key={r}
              style={[styles.reasonChip, reason === r && styles.reasonChipActive]}
              onPress={() => setReason(r)}
            >
              <Text style={[styles.reasonChipText, reason === r && styles.reasonChipTextActive]}>
                {r}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.sectionHeader}>NOTES (OPTIONAL)</Text>
        <View style={styles.notesWrapper}>
          <FormInput
            label="Additional notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Describe the adjustment…"
          />
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Adjustment will be logged with timestamp and reason.
        </Text>

        {/* Confirm */}
        <Button
          label="Confirm Adjustment"
          variant="primary"
          loading={isPending}
          onPress={handleConfirm}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  productHeader: {
    flexDirection: 'row', alignItems: 'center',
    margin: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  productEmoji: { fontSize: 36, marginRight: Spacing.s3 },
  productInfo: { flex: 1 },
  productName: { ...Typography.titleMD, color: Colors.t },
  breadcrumb: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  stepperCard: {
    margin: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s5, alignItems: 'center',
    ...Shadows.card,
  },
  stepperLabel: { ...Typography.label, color: Colors.t2 },
  currentStock: { ...Typography.displayMD, color: Colors.t, marginTop: 4, marginBottom: Spacing.s4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
    ...Shadows.card,
  },
  stepBtnTextRed: { fontSize: 28, color: Colors.rt, lineHeight: 32 },
  stepBtnTextGreen: { fontSize: 28, color: Colors.g, lineHeight: 32 },
  deltaDisplay: {
    width: 80, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.gy2,
  },
  deltaText: { ...Typography.titleLG },
  previewText: { ...Typography.bodyMD, color: Colors.t2, marginTop: Spacing.s4 },
  previewBold: { fontWeight: '700', color: Colors.t },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  reasonChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: Spacing.s4,
  },
  reasonChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.w, borderWidth: 1, borderColor: Colors.gy2,
  },
  reasonChipActive: { backgroundColor: Colors.g, borderColor: Colors.g },
  reasonChipText: { ...Typography.badge, color: Colors.t2 },
  reasonChipTextActive: { color: Colors.w },
  notesWrapper: { paddingHorizontal: Spacing.s4 },
  disclaimer: {
    ...Typography.bodySM, color: Colors.t2, fontStyle: 'italic',
    textAlign: 'center', paddingHorizontal: Spacing.s8, marginTop: Spacing.s2,
  },
});
