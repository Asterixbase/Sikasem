import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { taxApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button, Badge } from '@/components';

interface ExtractedField {
  value: string;
  confidence: number;
}

interface ExtractedData {
  vendor_name?: ExtractedField;
  tin?: ExtractedField;
  invoice_number?: ExtractedField;
  date?: ExtractedField;
  taxable_amount_pesawas?: ExtractedField;
  total_pesawas?: ExtractedField;
}

function ConfidenceChip({ pct }: { pct: number }) {
  const variant = pct >= 90 ? 'green' : pct >= 75 ? 'amber' : 'red';
  return <Badge label={`${pct}%`} variant={variant} />;
}

function FieldRow({ label, value, confidence }: { label: string; value: string; confidence: number }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRight}>
        <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
        <ConfidenceChip pct={confidence} />
      </View>
    </View>
  );
}

export default function InvExtScreen() {
  const params = useLocalSearchParams<{ data?: string }>();
  let extracted: ExtractedData = {};
  try {
    extracted = params.data ? JSON.parse(params.data) : {};
  } catch {
    extracted = {};
  }

  const vn = extracted.vendor_name ?? { value: 'ACCRA CENTRAL WHOLESALE LTD', confidence: 94 };
  const tin = extracted.tin ?? { value: 'C0012345678', confidence: 91 };
  const invNum = extracted.invoice_number ?? { value: 'INV-2026-04821', confidence: 96 };
  const date = extracted.date ?? { value: '28 March 2026', confidence: 88 };
  const taxable = extracted.taxable_amount_pesawas ?? { value: '108696', confidence: 97 };
  const total = extracted.total_pesawas ?? { value: '125000', confidence: 97 };

  const taxableNum = parseFloat(taxable.value) || 108696;
  const totalNum = parseFloat(total.value) || 125000;
  const vat = totalNum - taxableNum;
  const nhil = Math.round(taxableNum * 0.025);
  const getFund = Math.round(taxableNum * 0.025);

  const { mutate: saveInvoice, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => taxApi.saveInvoice(payload),
    onSuccess: () => {
      Alert.alert('Saved', 'Invoice saved to March 2026');
      router.push('/(main)/tax');
    },
    onError: () => Alert.alert('Error', 'Could not save invoice'),
  });

  const handleSave = () => {
    saveInvoice({
      vendor_name: vn.value,
      tin: tin.value,
      invoice_number: invNum.value,
      date: date.value,
      taxable_amount_pesawas: taxableNum,
      total_pesawas: totalNum,
      period: '2026-03',
    });
  };

  const handleDiscard = () => {
    Alert.alert('Discard', 'Discard this extraction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.push('/(main)/tax') },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Review Extraction" subtitle={vn.value} />
      <SafeScrollView>
        {/* Period banner */}
        <View style={styles.periodBanner}>
          <Text style={styles.periodText}>March 2026 VAT period</Text>
        </View>

        {/* Vendor Identity */}
        <Text style={styles.sectionHeader}>VENDOR IDENTITY</Text>
        <View style={styles.card}>
          <FieldRow label="Vendor Name" value={vn.value} confidence={vn.confidence} />
          <View style={styles.divider} />
          <FieldRow label="TIN" value={tin.value} confidence={tin.confidence} />
        </View>

        {/* Document Details */}
        <Text style={styles.sectionHeader}>DOCUMENT DETAILS</Text>
        <View style={styles.card}>
          <FieldRow label="Invoice #" value={invNum.value} confidence={invNum.confidence} />
          <View style={styles.divider} />
          <FieldRow label="Date" value={date.value} confidence={date.confidence} />
        </View>

        {/* Financial Reconciliation */}
        <Text style={styles.sectionHeader}>FINANCIAL RECONCILIATION</Text>
        <View style={styles.card}>
          <FieldRow
            label="Taxable Amount"
            value={`GHS ${(taxableNum / 100).toFixed(2)}`}
            confidence={taxable.confidence}
          />
          <View style={styles.divider} />
          <FieldRow
            label="Total (incl. VAT)"
            value={`GHS ${(totalNum / 100).toFixed(2)}`}
            confidence={total.confidence}
          />
          <View style={styles.divider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>VAT (15%)</Text>
            <Text style={styles.calcValue}>GHS {(vat / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>NHIL (2.5%)</Text>
            <Text style={styles.calcValue}>GHS {(nhil / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>GETFund (2.5%)</Text>
            <Text style={styles.calcValue}>GHS {(getFund / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Source document placeholder */}
        <Text style={styles.sectionHeader}>SOURCE DOCUMENT</Text>
        <View style={styles.docPlaceholder}>
          <Text style={styles.docText}>Source Document</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <Button
            label="DISCARD"
            variant="danger"
            style={styles.halfBtn}
            onPress={handleDiscard}
          />
          <Button
            label="SAVE TO MARCH 2026"
            variant="primary"
            style={styles.halfBtn}
            loading={isPending}
            onPress={handleSave}
          />
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  periodBanner: {
    margin: Spacing.s4, backgroundColor: Colors.gl,
    borderRadius: Radius.md, padding: Spacing.s3,
    borderLeftWidth: 3, borderLeftColor: Colors.g,
  },
  periodText: { ...Typography.bodyLG, color: Colors.g2 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  card: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.s4,
  },
  fieldLabel: { ...Typography.bodyMD, color: Colors.t2, flex: 1 },
  fieldRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 2, justifyContent: 'flex-end' },
  fieldValue: { ...Typography.bodyLG, color: Colors.t, flexShrink: 1 },
  divider: { height: 1, backgroundColor: Colors.gy2, marginHorizontal: Spacing.s4 },
  calcRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: Spacing.s4,
  },
  calcLabel: { ...Typography.bodyMD, color: Colors.t2 },
  calcValue: { ...Typography.bodyLG, color: Colors.t },
  docPlaceholder: {
    marginHorizontal: Spacing.s4, height: 160, backgroundColor: Colors.gy2,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  docText: { ...Typography.bodyMD, color: Colors.t2 },
  actionRow: { flexDirection: 'row', paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, gap: 8 },
  halfBtn: { flex: 1, marginHorizontal: 0 },
});
