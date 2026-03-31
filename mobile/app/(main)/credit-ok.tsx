import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ScreenHeader, SafeScrollView, Button,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GH', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export default function CreditOkScreen() {
  const params = useLocalSearchParams<{
    sale_id?: string;
    customer_name?: string;
    amount_pesawas?: string;
    due_date?: string;
    momo_phone?: string;
  }>();

  const amountPesawas = parseInt(params.amount_pesawas ?? '0', 10);
  const formattedAmount = `GHS ${(amountPesawas / 100).toFixed(2)}`;

  const handleWhatsApp = () => {
    router.push({
      pathname: '/(main)/whatsapp',
      params: {
        sale_id: params.sale_id,
        customer_name: params.customer_name,
        amount_pesawas: params.amount_pesawas,
        due_date: params.due_date,
      },
    });
  };

  const handleDone = () => {
    router.replace('/(main)/dash');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Credit Recorded"
        showBack={false}
      />

      <SafeScrollView>
        {/* Success indicator */}
        <View style={styles.successSection}>
          <View style={styles.successCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.leafEmoji}>🌿</Text>
          <Text style={styles.successTitle}>Credit recorded!</Text>
        </View>

        {/* MoMo queued note */}
        <View style={styles.amberNote}>
          <Text style={styles.amberNoteText}>
            MoMo collection request queued
          </Text>
        </View>

        {/* Credit archive card */}
        <View style={styles.archiveCard}>
          <Text style={styles.archiveTitle}>CREDIT ARCHIVE</Text>

          <View style={styles.archiveRow}>
            <Text style={styles.archiveLabel}>Customer</Text>
            <Text style={styles.archiveValue}>{params.customer_name ?? '—'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.archiveRow}>
            <Text style={styles.archiveLabel}>Maturity Date</Text>
            <Text style={styles.archiveValue}>
              {params.due_date ? formatDate(params.due_date) : '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.archiveRow}>
            <Text style={styles.archiveLabel}>Amount</Text>
            <Text style={[styles.archiveValue, styles.archiveValueGreen]}>
              {formattedAmount}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.archiveRow}>
            <Text style={styles.archiveLabel}>Settlement</Text>
            <Text style={styles.archiveValue}>MoMo Auto</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This credit sale has been recorded and a MoMo collection request will be
          automatically sent on the due date. The customer will receive a payment
          notification on their registered number.
        </Text>

        {/* Actions */}
        <Button
          label="Preview & send WhatsApp"
          variant="whatsapp"
          onPress={handleWhatsApp}
        />
        <Button
          label="Done"
          variant="secondary"
          onPress={handleDone}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  successSection: {
    alignItems: 'center',
    paddingTop: Spacing.s8,
    paddingBottom: Spacing.s5,
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.g,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.s2,
    ...Shadows.fab,
  },
  checkmark: { fontSize: 36, color: Colors.w, fontWeight: '900' },
  leafEmoji: { fontSize: 22, marginBottom: Spacing.s3 },
  successTitle: { ...Typography.titleLG, color: Colors.t },
  amberNote: {
    marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s3,
    backgroundColor: Colors.a,
    borderRadius: Radius.md,
    padding: Spacing.s3,
    alignItems: 'center',
  },
  amberNoteText: { ...Typography.bodyLG, color: Colors.at },
  archiveCard: {
    margin: Spacing.s4,
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  archiveTitle: {
    ...Typography.label, color: Colors.t2,
    marginBottom: Spacing.s4,
  },
  archiveRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: Spacing.s3,
  },
  archiveLabel: { ...Typography.bodySM, color: Colors.t2 },
  archiveValue: { ...Typography.bodyLG, color: Colors.t },
  archiveValueGreen: { color: Colors.g, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.gy2 },
  disclaimer: {
    ...Typography.bodySM, color: Colors.t2,
    fontStyle: 'italic',
    marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s4,
    textAlign: 'center',
    lineHeight: 16,
  },
});
