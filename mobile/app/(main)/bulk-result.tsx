import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/api';
import {
  ScreenHeader, SafeScrollView, Button,
  HorizontalBar, QuantityStepper, Badge,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

interface OcrData {
  product_id?: string;
  detected_qty?: number;
  strategy_label?: string;
  confidence_scores?: {
    product_name?: number;
    quantity?: number;
    unit_price?: number;
  };
  product_name?: string;
}

export default function BulkResultScreen() {
  const params = useLocalSearchParams<{ data?: string }>();

  const ocrData: OcrData = React.useMemo(() => {
    try { return params.data ? JSON.parse(params.data) : {}; }
    catch { return {}; }
  }, [params.data]);

  const detectedQty = ocrData.detected_qty ?? 60;
  const [overrideQty, setOverrideQty] = useState(detectedQty);
  const productName = ocrData.product_name ?? '';
  const strategyLabel = ocrData.strategy_label ?? 'OCR DETECTION';

  const confidence = ocrData.confidence_scores ?? {
    product_name: 92,
    quantity: 88,
    unit_price: 79,
  };

  // For voice count there is no product_id — skip the stock API and go straight
  // to dashboard. The count is confirmed visually; user can adjust via inv-adjust.
  const handleConfirm = () => {
    if (!ocrData.product_id) {
      router.dismissAll();
      return;
    }
    mutation.mutate();
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/stock/movements', {
        product_id: ocrData.product_id,
        quantity: overrideQty,
        type: 'stock_in',
        source: 'bulk_ocr',
      }),
    onSuccess: () => router.dismissAll(),
    onError: (e: any) =>
      Alert.alert('Failed', e?.response?.data?.detail ?? 'Could not record movement'),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Bulk Result"
        subtitle={strategyLabel.toUpperCase()}
        onBack={() => router.back()}
      />

      <SafeScrollView>
        {/* Large detected count */}
        <View style={styles.heroSection}>
          {productName ? (
            <Text style={styles.productName}>{productName}</Text>
          ) : null}
          <Text style={styles.detectedCount}>{detectedQty} pcs detected</Text>
          <Badge label={strategyLabel} variant="green" />
        </View>

        {/* Confidence bars */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Detection Confidence</Text>

          <HorizontalBar
            label="Product Name"
            value={`${confidence.product_name ?? 92}%`}
            pct={confidence.product_name ?? 92}
            color={Colors.g}
          />
          <HorizontalBar
            label="Quantity"
            value={`${confidence.quantity ?? 88}%`}
            pct={confidence.quantity ?? 88}
            color={Colors.g2}
          />
          <HorizontalBar
            label="Unit Price"
            value={`${confidence.unit_price ?? 79}%`}
            pct={confidence.unit_price ?? 79}
            color={Colors.bt}
          />
        </View>

        {/* Override stepper */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Override Quantity</Text>
          <Text style={styles.stepperHint}>Adjust if the detected count is incorrect</Text>
          <View style={styles.stepperRow}>
            <QuantityStepper
              value={overrideQty}
              onChange={setOverrideQty}
              min={1}
              max={9999}
            />
            <Text style={styles.stepperQty}>{overrideQty} pcs</Text>
          </View>
        </View>

        {/* Actions */}
        <Button
          label={`Confirm ${overrideQty} pcs`}
          variant="primary"
          loading={mutation.isPending}
          onPress={handleConfirm}
          style={styles.confirmBtn}
        />
        <Button
          label="Discard"
          variant="secondary"
          onPress={() => router.back()}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  heroSection: {
    margin: Spacing.s4,
    marginBottom: 0,
    padding: Spacing.s6,
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    alignItems: 'flex-start',
    gap: Spacing.s2,
    ...Shadows.card,
  },
  productName: { ...Typography.label, color: Colors.t2, marginBottom: 2 },
  detectedCount: { ...Typography.displayLG, color: Colors.t },
  card: {
    margin: Spacing.s4,
    marginBottom: 0,
    padding: Spacing.s5,
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    ...Shadows.card,
  },
  sectionTitle: { ...Typography.titleSM, color: Colors.t, marginBottom: Spacing.s3 },
  stepperHint: { ...Typography.bodySM, color: Colors.t2, marginBottom: Spacing.s4 },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperQty: { ...Typography.titleMD, color: Colors.t },
  confirmBtn: { marginTop: Spacing.s5 },
});
