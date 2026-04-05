import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { taxApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  HeroCard,
  LoadingState,
  ErrorState,
} from '@/components';
import { fmtDateShort } from '@/utils/date';

export default function TaxScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tax-dashboard'],
    queryFn: () => taxApi.dashboard().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading tax data…" />;
  if (error) return <ErrorState message="Could not load tax dashboard" />;

  const d = data ?? {};
  const outputVat: number = d.output_vat_pesawas ?? 450000;
  const inputVat: number = d.input_vat_pesawas ?? 210000;
  const netVat: number = d.net_vat_pesawas ?? 240000;

  // Backend returns vendor_name / total_amount_pesawas / vat_amount_pesawas / invoice_date
  const rawInvoices: any[] = d.recent_invoices ?? [];
  const invoices = rawInvoices.map(inv => ({
    vendor: inv.vendor_name ?? inv.vendor ?? '—',
    date:   inv.invoice_date ? fmtDateShort(inv.invoice_date) : (inv.date ?? ''),
    amount: inv.total_amount_pesawas ?? inv.amount ?? 0,
    vat:    inv.vat_amount_pesawas   ?? inv.vat   ?? 0,
  }));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Tax compliance"
        subtitle="March 2026"
        right={
          <Pressable onPress={() => router.push('/(main)/inv-list')} hitSlop={8}>
            <Text style={styles.archiveBtn}>Archive</Text>
          </Pressable>
        }
      />
      <SafeScrollView>
        {/* Hero — Net VAT Payable */}
        <HeroCard
          label="NET VAT PAYABLE"
          amount={netVat}
        />

        {/* Output / Input VAT tiles */}
        <View style={styles.tiles}>
          <View style={[styles.vatTile, styles.vatGreen]}>
            <Text style={styles.vatLabel}>Output VAT</Text>
            <Text style={styles.vatAmount}>GHS {(outputVat / 100).toFixed(2)}</Text>
          </View>
          <View style={[styles.vatTile, styles.vatBlue]}>
            <Text style={[styles.vatLabel, { color: Colors.bt }]}>Input VAT</Text>
            <Text style={[styles.vatAmount, { color: Colors.bt }]}>GHS {(inputVat / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Deadline card */}
        <View style={styles.deadlineCard}>
          <Text style={styles.deadlineTitle}>Due in 35 days</Text>
          <Text style={styles.deadlineDate}>30 April 2026</Text>
        </View>

        {/* GRA Export button */}
        <Pressable style={styles.graBtn} onPress={() => router.push('/(main)/gra')}>
          <Text style={styles.graBtnText}>GRA VAT Export</Text>
          <Text style={styles.graBtnArrow}>›</Text>
        </Pressable>

        {/* Journal section */}
        <Text style={styles.sectionHeader}>JOURNAL — Recent Invoices</Text>
        <View style={styles.invoiceList}>
          {invoices.map((inv, i) => (
            <Pressable
              key={i}
              style={styles.invoiceRow}
              onPress={() => router.push('/(main)/inv-list')}
            >
              <View style={styles.invoiceLeft}>
                <Text style={styles.invoiceVendor} numberOfLines={1}>{inv.vendor}</Text>
                <Text style={styles.invoiceDate}>{inv.date}</Text>
              </View>
              <View style={styles.invoiceRight}>
                <Text style={styles.invoiceAmount}>GHS {(inv.amount / 100).toFixed(2)}</Text>
                <Text style={styles.invoiceVat}>VAT {(inv.vat / 100).toFixed(2)}</Text>
              </View>
              <Text style={styles.invoiceArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </SafeScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push('/(main)/inv')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  archiveBtn: { ...Typography.badge, color: Colors.g },
  tiles: { flexDirection: 'row', paddingHorizontal: Spacing.s4, gap: 8 },
  vatTile: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  vatGreen: { backgroundColor: Colors.gl },
  vatBlue: { backgroundColor: Colors.b },
  vatLabel: { ...Typography.label, color: Colors.g2, marginBottom: 4 },
  vatAmount: { ...Typography.titleMD, color: Colors.g2 },
  deadlineCard: {
    margin: Spacing.s4, backgroundColor: Colors.a, borderRadius: Radius.lg,
    padding: Spacing.s5, borderLeftWidth: 4, borderLeftColor: Colors.at,
  },
  deadlineTitle: { ...Typography.titleMD, color: Colors.at },
  deadlineDate: { ...Typography.bodyMD, color: Colors.at, marginTop: 2 },
  graBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    backgroundColor: Colors.w, borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  graBtnText: { ...Typography.bodyLG, color: Colors.bt },
  graBtnArrow: { fontSize: 18, color: Colors.t2 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  invoiceList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  invoiceLeft: { flex: 1, marginRight: 8 },
  invoiceVendor: { ...Typography.bodyLG, color: Colors.t },
  invoiceDate: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end', marginRight: 4 },
  invoiceAmount: { ...Typography.bodyLG, color: Colors.t },
  invoiceVat: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  invoiceArrow: { fontSize: 16, color: Colors.t2 },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.g,
    alignItems: 'center', justifyContent: 'center', ...Shadows.fab,
  },
  fabText: { fontSize: 28, color: Colors.w, lineHeight: 32, marginTop: -2 },
});
