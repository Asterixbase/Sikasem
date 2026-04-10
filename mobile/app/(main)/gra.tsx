import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking, Pressable } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { taxApi } from '@/api';
import { API_BASE, getAccessToken } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button, LoadingState } from '@/components';
import { useThemePalette } from '@/store/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { screenPad } from '@/utils/layout';

const GRA_PORTAL = 'https://etax.gra.gov.gh';

const STEPS = [
  { n: '1', text: 'Download your VAT CSV below' },
  { n: '2', text: 'Open the GRA e-Tax portal and log in' },
  { n: '3', text: 'Select "VAT Return" → "File Return"' },
  { n: '4', text: 'Upload the CSV and submit' },
];

export default function GraScreen() {
  const theme = useThemePalette();
  const insets = useSafeAreaInsets();
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tax-dashboard'],
    queryFn: () => taxApi.dashboard().then(r => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingState message="Loading VAT summary…" />;

  const d = data ?? {};
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth() + 1;

  const taxableSales: number = d.taxable_sales_pesawas ?? 0;
  const outputVat: number    = d.output_vat_pesawas    ?? 0;
  const inputVat: number     = d.input_vat_pesawas     ?? 0;
  const netVat: number       = d.net_vat_pesawas        ?? 0;

  const tableRows = [
    { label: 'Taxable Sales',   amount: taxableSales },
    { label: 'Output VAT',      amount: outputVat },
    { label: 'Input VAT',       amount: inputVat },
    { label: 'Net VAT Payable', amount: netVat, bold: true },
  ];

  const handleDownloadCsv = async () => {
    setCsvLoading(true);
    try {
      const token = await getAccessToken();
      const url  = `${API_BASE}/tax/periods/${year}/${String(month).padStart(2,'0')}/export/csv`;
      const dest = FileSystem.documentDirectory + `sikasem_vat_${year}_${String(month).padStart(2,'0')}.csv`;

      const result = await FileSystem.downloadAsync(url, dest, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (result.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save GRA VAT CSV',
          });
        } else {
          Alert.alert('Downloaded', `Saved to: ${result.uri}`);
        }
      } else {
        Alert.alert('Error', 'Could not download CSV');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not download CSV');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const html = buildAuditHtml({ year, month, taxableSales, outputVat, inputVat, netVat, invoices: d.recent_invoices ?? [] });
      const htmlPath = FileSystem.documentDirectory + 'sikasem_vat_audit.html';
      await FileSystem.writeAsStringAsync(htmlPath, html, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(htmlPath, {
          mimeType: 'text/html',
          dialogTitle: 'Save VAT Audit Report',
          UTI: 'public.html',
        });
      } else {
        Alert.alert('Downloaded', 'VAT audit report ready to share');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate report');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSubmitOnPortal = async () => {
    // 1. Download the CSV so they have it ready, then open the portal
    try {
      const supported = await Linking.canOpenURL(GRA_PORTAL);
      if (!supported) {
        Alert.alert('Cannot open browser', 'Please visit etax.gra.gov.gh manually.');
        return;
      }
      Alert.alert(
        'Opening GRA e-Tax Portal',
        'Download your VAT CSV first if you haven\'t already, then upload it on the GRA portal under VAT → File Return.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Portal',
            onPress: () => Linking.openURL(GRA_PORTAL),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not open portal');
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="GRA VAT Filing" />
      <SafeScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* Return status card */}
        <View style={[styles.readyCard, { backgroundColor: theme.primary }]}>
          <Text style={styles.readyTitle}>✓ Return ready for filing</Text>
          <Text style={styles.readySub}>
            {d.invoice_count ?? 0} invoices · GHS {(netVat / 100).toFixed(2)} net VAT payable
          </Text>
        </View>

        {/* Step-by-step guide */}
        <Text style={styles.sectionHeader}>HOW TO SUBMIT ELECTRONICALLY</Text>
        <View style={styles.stepsCard}>
          {STEPS.map((s, i) => (
            <View key={s.n}>
              <View style={styles.stepRow}>
                <View style={[styles.stepBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.stepN}>{s.n}</Text>
                </View>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
              {i < STEPS.length - 1 && <View style={styles.stepLine} />}
            </View>
          ))}
        </View>

        {/* VAT Summary */}
        <Text style={styles.sectionHeader}>VAT SUMMARY</Text>
        <View style={styles.card}>
          {tableRows.map((row, i) => (
            <View key={i}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, row.bold && styles.tableBold]}>{row.label}</Text>
                <Text style={[styles.tableAmount, row.bold && styles.tableBold]}>
                  GHS {(row.amount / 100).toFixed(2)}
                </Text>
              </View>
              {i < tableRows.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Primary: Open GRA portal */}
          <Pressable
            style={[styles.portalBtn, { backgroundColor: theme.primary }]}
            onPress={handleSubmitOnPortal}
          >
            <Text style={styles.portalBtnIcon}>🏛️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.portalBtnLabel}>Submit on GRA e-Tax Portal</Text>
              <Text style={styles.portalBtnSub}>Opens etax.gra.gov.gh</Text>
            </View>
            <Text style={styles.portalBtnArrow}>›</Text>
          </Pressable>

          {/* Secondary: Download CSV (to upload to portal) */}
          <Button
            label={csvLoading ? 'Downloading…' : '⬇  Download VAT CSV'}
            variant="primary"
            loading={csvLoading}
            onPress={handleDownloadCsv}
          />

          {/* Tertiary: PDF Audit */}
          <Button
            label={pdfLoading ? 'Generating…' : '⬇  Download PDF Audit Report'}
            variant="secondary"
            loading={pdfLoading}
            onPress={handleDownloadPdf}
          />
        </View>

        {/* CSV Preview */}
        <Text style={styles.sectionHeader}>CSV PREVIEW</Text>
        <View style={styles.csvBlock}>
          <Text style={styles.csvTitle}>Part A — Sales</Text>
          <Text style={styles.csvCode}>{`TIN,InvoiceNo,Date,TaxableAmt,VAT\nC001234,RCP-001,${year}-${String(month).padStart(2,'0')}-28,1080.00,162.00\nC001234,RCP-002,${year}-${String(month).padStart(2,'0')}-27,875.00,131.25`}</Text>
        </View>
        <View style={styles.csvBlock}>
          <Text style={styles.csvTitle}>Part B — Purchases</Text>
          <Text style={styles.csvCode}>{`TIN,InvoiceNo,Date,TaxableAmt,InputVAT\nC005678,INV-ACC-001,${year}-${String(month).padStart(2,'0')}-26,791.67,118.75`}</Text>
        </View>

      </SafeScrollView>
    </View>
  );
}

function buildAuditHtml({ year, month, taxableSales, outputVat, inputVat, netVat, invoices }: any) {
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sikasem VAT Audit Report — ${monthName} ${year}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#0F172A;}
h1{color:#0F766E;}table{width:100%;border-collapse:collapse;margin:16px 0;}
th,td{border:1px solid #E2E8F0;padding:10px 14px;text-align:left;}
th{background:#F8FAFC;font-weight:600;}
.total{font-weight:700;color:#0F766E;font-size:18px;}
.footer{margin-top:40px;color:#94A3B8;font-size:12px;}
</style></head><body>
<h1>Sikasem VAT Audit Report</h1>
<p><strong>Period:</strong> ${monthName} ${year} &nbsp;|&nbsp; <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
<h2>VAT Summary</h2>
<table><tr><th>Description</th><th>Amount (GHS)</th></tr>
<tr><td>Taxable Sales</td><td>${(taxableSales/100).toFixed(2)}</td></tr>
<tr><td>Output VAT (15%)</td><td>${(outputVat/100).toFixed(2)}</td></tr>
<tr><td>Input VAT (deductible)</td><td>${(inputVat/100).toFixed(2)}</td></tr>
<tr><td class="total">Net VAT Payable</td><td class="total">${(netVat/100).toFixed(2)}</td></tr>
</table>
<p class="footer">Generated by Sikasem · sikasem.gh · This report is for filing reference only.</p>
</body></html>`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },

  readyCard: {
    margin: screenPad, borderRadius: Radius.xl, padding: Spacing.s5, ...Shadows.card,
  },
  readyTitle: { ...Typography.titleMD, color: Colors.w },
  readySub:   { ...Typography.bodyMD, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: screenPad, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },

  stepsCard: {
    marginHorizontal: screenPad, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s5, ...Shadows.card,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s3 },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepN:    { ...Typography.badge, color: Colors.w, fontWeight: '800' },
  stepText: { ...Typography.bodyMD, color: Colors.t, flex: 1 },
  stepLine: { height: 16, width: 1, backgroundColor: Colors.gy2, marginLeft: 14, marginVertical: 2 },

  card: {
    marginHorizontal: screenPad, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: Spacing.s4,
  },
  tableLabel:  { ...Typography.bodyMD, color: Colors.t2 },
  tableAmount: { ...Typography.bodyLG, color: Colors.t },
  tableBold:   { fontWeight: '700', color: Colors.g },
  divider:     { height: 1, backgroundColor: Colors.gy2, marginHorizontal: Spacing.s4 },

  actions: { paddingHorizontal: screenPad, paddingTop: Spacing.s4, gap: Spacing.s2 },

  portalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    borderRadius: Radius.xl, padding: Spacing.s4,
    marginBottom: Spacing.s2, ...Shadows.card,
  },
  portalBtnIcon:  { fontSize: 28 },
  portalBtnLabel: { ...Typography.titleSM, color: Colors.w },
  portalBtnSub:   { ...Typography.bodySM, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  portalBtnArrow: { fontSize: 22, color: Colors.w, fontWeight: '700' },

  csvBlock: {
    marginHorizontal: screenPad, marginBottom: Spacing.s3,
    backgroundColor: Colors.csvBg, borderRadius: Radius.md, padding: Spacing.s4,
  },
  csvTitle: { ...Typography.label, color: Colors.csvText, marginBottom: 8 },
  csvCode:  { fontFamily: 'Courier New', fontSize: 11, color: Colors.csvText, lineHeight: 18 },
});
