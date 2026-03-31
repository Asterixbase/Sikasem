import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { taxApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, LoadingState, ErrorState } from '@/components';

interface Invoice {
  id: string;
  vendor_name: string;
  date: string;
  amount_pesawas: number;
  vat_pesawas: number;
}

export default function InvListScreen() {
  const [search, setSearch] = useState('');
  const period = '2026-03';

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', period],
    queryFn: () => taxApi.listInvoices(period).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading invoices…" />;
  if (error) return <ErrorState message="Could not load invoices" />;

  const invoices: Invoice[] = data?.invoices ?? [
    { id: '1', vendor_name: 'Accra Central Wholesale Ltd', date: '28 Mar 2026', amount_pesawas: 124000, vat_pesawas: 18600 },
    { id: '2', vendor_name: 'Gold Coast Supplies Co.', date: '27 Mar 2026', amount_pesawas: 87500, vat_pesawas: 13125 },
    { id: '3', vendor_name: 'Tema Port Logistics', date: '25 Mar 2026', amount_pesawas: 310000, vat_pesawas: 46500 },
    { id: '4', vendor_name: 'Kumasi Fresh Market', date: '24 Mar 2026', amount_pesawas: 55000, vat_pesawas: 8250 },
    { id: '5', vendor_name: 'Kantamanto Trading', date: '22 Mar 2026', amount_pesawas: 200000, vat_pesawas: 30000 },
  ];

  const filtered = invoices.filter(inv =>
    inv.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Invoice Archive" subtitle="March 2026" />
      <SafeScrollView>
        {/* Filter bar */}
        <View style={styles.filterRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search vendor…"
              placeholderTextColor={Colors.t2}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Date range row */}
        <View style={styles.filterChips}>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>01 Mar 2026</Text>
          </View>
          <Text style={styles.dateArrow}>→</Text>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>31 Mar 2026</Text>
          </View>
          <View style={[styles.dateChip, { backgroundColor: Colors.gl }]}>
            <Text style={[styles.dateChipText, { color: Colors.g2 }]}>All Types</Text>
          </View>
        </View>

        {/* Invoice list */}
        <Text style={styles.resultCount}>{filtered.length} invoices</Text>
        <View style={styles.invoiceList}>
          {filtered.map((inv, idx) => (
            <Pressable
              key={inv.id}
              style={[styles.invoiceRow, idx === filtered.length - 1 && styles.noBorder]}
              onPress={() => router.push({ pathname: '/(main)/inv-ext', params: { data: JSON.stringify({}) } })}
            >
              {/* Thumbnail */}
              <View style={styles.thumb}>
                <Text style={styles.thumbText}>📄</Text>
              </View>
              {/* Details */}
              <View style={styles.invoiceDetails}>
                <Text style={styles.vendorName} numberOfLines={1}>{inv.vendor_name}</Text>
                <Text style={styles.invoiceDate}>{inv.date}</Text>
              </View>
              {/* Amounts */}
              <View style={styles.invoiceAmounts}>
                <Text style={styles.amount}>GHS {(inv.amount_pesawas / 100).toFixed(2)}</Text>
                <Text style={styles.vatAmount}>VAT {(inv.vat_pesawas / 100).toFixed(2)}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No invoices match your search</Text>
          </View>
        )}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  filterRow: {
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.s3, paddingVertical: Spacing.s2,
    borderBottomWidth: 2, borderBottomColor: Colors.g,
    ...Shadows.card,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, ...Typography.bodyLG, color: Colors.t },
  filterChips: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s3,
  },
  dateChip: {
    backgroundColor: Colors.w, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.gy2,
  },
  dateChipText: { ...Typography.badge, color: Colors.t2 },
  dateArrow: { ...Typography.bodySM, color: Colors.t2 },
  resultCount: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s2,
  },
  invoiceList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  thumb: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.s3,
  },
  thumbText: { fontSize: 20 },
  invoiceDetails: { flex: 1, marginRight: 8 },
  vendorName: { ...Typography.bodyLG, color: Colors.t },
  invoiceDate: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  invoiceAmounts: { alignItems: 'flex-end', marginRight: 4 },
  amount: { ...Typography.bodyLG, color: Colors.t },
  vatAmount: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  arrow: { fontSize: 16, color: Colors.t2 },
  emptyState: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyMD, color: Colors.t2 },
});
