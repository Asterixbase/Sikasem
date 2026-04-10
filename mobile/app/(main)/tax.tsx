import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  HeroCard,
  LoadingState,
} from '@/components';
import { fmtDateShort } from '@/utils/date';
import { useThemePalette } from '@/store/theme';

export default function TaxScreen() {
  const theme = useThemePalette();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['tax-dashboard'],
    queryFn: () => taxApi.dashboard().then(r => r.data),
    staleTime: 60_000,
  });

  // Always render with fallbacks — never block the screen on API error
  const d = data ?? {};
  const outputVat: number = d.output_vat_pesawas ?? 0;
  const inputVat: number  = d.input_vat_pesawas  ?? 0;
  const netVat: number    = d.net_vat_pesawas     ?? 0;

  const rawInvoices: any[] = d.recent_invoices ?? [];
  const invoices = rawInvoices.map(inv => ({
    vendor: inv.vendor_name ?? inv.vendor ?? '—',
    date:   inv.invoice_date ? fmtDateShort(inv.invoice_date) : (inv.date ?? ''),
    amount: inv.total_amount_pesawas ?? inv.amount ?? 0,
    vat:    inv.vat_amount_pesawas   ?? inv.vat   ?? 0,
  }));

  if (isLoading) return <LoadingState message="Loading tax data…" />;

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

      <SafeScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
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

        {/* ── SUBMIT RETURN — primary CTA ── */}
        <Pressable
          style={[styles.submitBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(main)/gra')}
        >
          <View style={styles.submitBtnInner}>
            <Text style={styles.submitBtnIcon}>🏛️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.submitBtnLabel}>Submit VAT Return</Text>
              <Text style={styles.submitBtnSub}>
                File electronically · Download CSV · Open GRA e-Tax Portal
              </Text>
            </View>
            <Text style={styles.submitBtnArrow}>›</Text>
          </View>
        </Pressable>

        {/* GRA Export secondary link */}
        <Pressable style={styles.graBtn} onPress={() => router.push('/(main)/gra')}>
          <Text style={styles.graBtnText}>GRA VAT Export &amp; Filing</Text>
          <Text style={styles.graBtnArrow}>›</Text>
        </Pressable>

        {/* Journal section */}
        <Text style={styles.sectionHeader}>JOURNAL — Recent Invoices</Text>
        <View style={styles.invoiceList}>
          {invoices.length === 0 ? (
            <View style={styles.emptyInvoices}>
              <Text style={styles.emptyText}>No invoices this period</Text>
            </View>
          ) : invoices.map((inv, i) => (
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

      {/* FAB — add new invoice, respects safe-area */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 16, backgroundColor: theme.primary }]}
        onPress={() => router.push('/(main)/inv')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  archiveBtn: { ...Typography.badge, color: Colors.g },

  tiles: { flexDirection: 'row', paddingHorizontal: Spacing.s4, gap: 8, marginBottom: Spacing.s3 },
  vatTile: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  vatGreen: { backgroundColor: Colors.gl },
  vatBlue:  { backgroundColor: Colors.b },
  vatLabel:  { ...Typography.label, color: Colors.g2, marginBottom: 4 },
  vatAmount: { ...Typography.titleMD, color: Colors.g2 },

  deadlineCard: {
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    backgroundColor: Colors.a, borderRadius: Radius.lg,
    padding: Spacing.s5, borderLeftWidth: 4, borderLeftColor: Colors.at,
  },
  deadlineTitle: { ...Typography.titleMD, color: Colors.at },
  deadlineDate:  { ...Typography.bodyMD, color: Colors.at, marginTop: 2 },

  // Primary submit button
  submitBtn: {
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    borderRadius: Radius.xl, overflow: 'hidden',
    ...Shadows.card,
  },
  submitBtnInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, gap: Spacing.s3,
  },
  submitBtnIcon:  { fontSize: 28 },
  submitBtnLabel: { ...Typography.titleSM, color: Colors.w },
  submitBtnSub:   { ...Typography.bodySM, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  submitBtnArrow: { fontSize: 22, color: Colors.w, fontWeight: '700' },

  graBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    backgroundColor: Colors.w, borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  graBtnText:  { ...Typography.bodyLG, color: Colors.bt },
  graBtnArrow: { fontSize: 18, color: Colors.t2 },

  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s2, paddingBottom: Spacing.s2,
  },
  invoiceList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
    marginBottom: Spacing.s4,
  },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  invoiceLeft:   { flex: 1, marginRight: 8 },
  invoiceVendor: { ...Typography.bodyLG, color: Colors.t },
  invoiceDate:   { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  invoiceRight:  { alignItems: 'flex-end', marginRight: 4 },
  invoiceAmount: { ...Typography.bodyLG, color: Colors.t },
  invoiceVat:    { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  invoiceArrow:  { fontSize: 16, color: Colors.t2 },
  emptyInvoices: { padding: Spacing.s6, alignItems: 'center' },
  emptyText:     { ...Typography.bodyMD, color: Colors.t2 },

  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', ...Shadows.fab,
    zIndex: 20,
  },
  fabText: { fontSize: 28, color: Colors.w, lineHeight: 32, marginTop: -2 },
});
