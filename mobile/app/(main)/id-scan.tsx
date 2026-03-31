import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ScreenHeader, SafeScrollView, Button, Badge,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

interface OcrIdData {
  full_name?: string;
  id_number?: string;
  date_of_birth?: string;
  confidence?: {
    full_name?: number;
    id_number?: number;
    date_of_birth?: number;
  };
}

function ConfidenceChip({ pct }: { pct: number }) {
  const variant = pct >= 90 ? 'green' : pct >= 80 ? 'amber' : 'red';
  return <Badge label={`${pct}%`} variant={variant} />;
}

export default function IdScanScreen() {
  const params = useLocalSearchParams<{ data?: string }>();

  const ocr: OcrIdData = React.useMemo(() => {
    try { return params.data ? JSON.parse(params.data) : {}; }
    catch { return {}; }
  }, [params.data]);

  // Fallback demo data for display
  const fullName = ocr.full_name ?? 'KWAME OSEI MENSAH';
  const idNumber = ocr.id_number ?? 'GHA-123456789-0';
  const dob = ocr.date_of_birth ?? '15 MAR 1985';
  const confidence = ocr.confidence ?? {
    full_name: 94,
    id_number: 91,
    date_of_birth: 88,
  };

  const handleUseId = () => {
    router.push({
      pathname: '/(main)/credit-step2',
      params: {
        customer_name: fullName,
        id_number: idNumber,
        id_type: 'ghana_card',
        from_scan: '1',
      },
    });
  };

  const handleRescan = () => {
    router.back();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="ID Scan Result"
        subtitle="OCR EXTRACTION"
        onBack={() => router.back()}
      />

      <SafeScrollView>
        <Text style={styles.pageHint}>Review extracted details before continuing</Text>

        {/* Extracted fields card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Extracted ID Fields</Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldMeta}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <Text style={styles.fieldValue}>{fullName}</Text>
            </View>
            <ConfidenceChip pct={confidence.full_name ?? 94} />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldRow}>
            <View style={styles.fieldMeta}>
              <Text style={styles.fieldLabel}>ID NUMBER</Text>
              <Text style={styles.fieldValue}>{idNumber}</Text>
            </View>
            <ConfidenceChip pct={confidence.id_number ?? 91} />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldRow}>
            <View style={styles.fieldMeta}>
              <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
              <Text style={styles.fieldValue}>{dob}</Text>
            </View>
            <ConfidenceChip pct={confidence.date_of_birth ?? 88} />
          </View>
        </View>

        {/* Accuracy note */}
        <View style={styles.noteBanner}>
          <Text style={styles.noteText}>
            Review details carefully before proceeding. Low confidence fields may need correction.
          </Text>
        </View>

        {/* Actions */}
        <Button
          label="Use this ID →"
          variant="primary"
          onPress={handleUseId}
        />
        <Button
          label="Re-scan"
          variant="secondary"
          onPress={handleRescan}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  pageHint: {
    ...Typography.bodySM, color: Colors.t2,
    textAlign: 'center', paddingTop: Spacing.s4,
    paddingHorizontal: Spacing.s4,
  },
  card: {
    margin: Spacing.s4,
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.g,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.titleSM, color: Colors.g,
    marginBottom: Spacing.s4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.s3,
  },
  fieldMeta: { flex: 1, marginRight: Spacing.s2 },
  fieldLabel: { ...Typography.label, color: Colors.t2, marginBottom: 3 },
  fieldValue: { ...Typography.bodyLG, color: Colors.t },
  divider: {
    height: 1, backgroundColor: Colors.gy2,
  },
  noteBanner: {
    marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s2,
    backgroundColor: Colors.a,
    borderRadius: Radius.md,
    padding: Spacing.s3,
  },
  noteText: { ...Typography.bodySM, color: Colors.at },
});
