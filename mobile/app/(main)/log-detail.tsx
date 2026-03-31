import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button, Badge, LoadingState, ErrorState } from '@/components';

interface LogDetail {
  id: string;
  title: string;
  description: string;
  severity: 'success' | 'warning' | 'critical';
  confidence: number;
  sha256: string;
  timestamp: string;
  source: string;
  executed_by: string;
  origin_ip: string;
  event_id: string;
  linked_invoice?: string;
  linked_amount_pesawas?: number;
}

const MOCK_DETAIL: LogDetail = {
  id: 'LOG-88421',
  title: 'OCR extraction completed',
  description: 'Invoice INV-2026-04821 was successfully extracted from source image using OCR Archivist engine. All fields validated against GRA schema. Confidence threshold met.',
  severity: 'success',
  confidence: 98.4,
  sha256: 'a3f5c89d1e2b4a7f6c0d3e9b2a1f5c8e4d7b3a2f6c9e1d4b7a0f3c6e9b2d5a8',
  timestamp: '28 Mar 2026 · 09:14:32 GMT',
  source: 'OCR Engine v2.3.1',
  executed_by: 'Ama Mensah',
  origin_ip: '197.251.XXX.XXX',
  event_id: 'EVT-20260328-088421',
  linked_invoice: '#INV-2026-04821',
  linked_amount_pesawas: 42000,
};

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-log', id],
    queryFn: () => adminApi.logDetail(id ?? '').then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) return <LoadingState message="Loading event details…" />;
  if (error) return <ErrorState message="Could not load event" />;

  const log: LogDetail = data ?? MOCK_DETAIL;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Event Details"
        subtitle={`REF: ${log.id}`}
        right={
          <Text
            style={styles.exportBtn}
            onPress={() => Alert.alert('Export', 'PDF export coming soon')}
          >
            PDF
          </Text>
        }
      />
      <SafeScrollView>
        {/* Status banner */}
        <View style={[
          styles.statusBanner,
          { backgroundColor: log.severity === 'success' ? Colors.gl : log.severity === 'warning' ? Colors.a : Colors.r },
        ]}>
          <Text style={[
            styles.statusText,
            { color: log.severity === 'success' ? Colors.g2 : log.severity === 'warning' ? Colors.at : Colors.rt },
          ]}>
            {log.severity === 'success' ? 'OPERATIONAL SUCCESS' : log.severity === 'warning' ? 'WARNING' : 'CRITICAL EVENT'}
          </Text>
        </View>

        {/* Title + description */}
        <View style={styles.card}>
          <Text style={styles.logTitle}>{log.title}</Text>
          <Text style={styles.logDesc}>{log.description}</Text>
        </View>

        {/* Confidence + JSON download */}
        <View style={styles.confidenceRow}>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{log.confidence}% CONFIDENCE SCORE</Text>
          </View>
          <Text
            style={styles.jsonBtn}
            onPress={() => Alert.alert('Raw JSON', `Event ID: ${log.event_id}\n\nJSON export coming soon`)}
          >
            Download Raw JSON
          </Text>
        </View>

        {/* Linked entities */}
        {log.linked_invoice && (
          <>
            <Text style={styles.sectionHeader}>LINKED ENTITIES</Text>
            <View style={styles.linkedCard}>
              <Text style={styles.linkedInvoice}>Invoice {log.linked_invoice}</Text>
              <Text style={styles.linkedAmount}>
                GHS {((log.linked_amount_pesawas ?? 0) / 100).toFixed(2)}
              </Text>
              <Badge label="Verified Total" variant="green" />
            </View>
          </>
        )}

        {/* Integrity card */}
        <View style={styles.integrityCard}>
          <Text style={styles.integrityTitle}>Integrity Verified</Text>
          <Text style={styles.integrityHash} numberOfLines={2} selectable>
            SHA-256: {log.sha256}
          </Text>
        </View>

        {/* Audit metadata */}
        <Text style={styles.sectionHeader}>AUDIT METADATA</Text>
        <View style={styles.metaCard}>
          {[
            { label: 'Timestamp', value: log.timestamp },
            { label: 'Source', value: log.source },
            { label: 'Executed By', value: log.executed_by },
            { label: 'Origin IP', value: log.origin_ip },
            { label: 'Event ID', value: log.event_id },
          ].map((row, idx, arr) => (
            <View key={row.label}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{row.label}</Text>
                <Text style={styles.metaValue}>{row.value}</Text>
              </View>
              {idx < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Document placeholder */}
        <Text style={styles.sectionHeader}>SOURCE DOCUMENT</Text>
        <View style={styles.docPlaceholder}>
          <Text style={styles.docText}>Document Image</Text>
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  exportBtn: { ...Typography.badge, color: Colors.bt, fontWeight: '700' },
  statusBanner: {
    margin: Spacing.s4, borderRadius: Radius.md, padding: Spacing.s3,
    alignItems: 'center',
  },
  statusText: { ...Typography.label, letterSpacing: 1 },
  card: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  logTitle: { ...Typography.titleMD, color: Colors.t, marginBottom: 6 },
  logDesc: { ...Typography.bodyMD, color: Colors.t2, lineHeight: 20 },
  confidenceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.s4, marginTop: Spacing.s3,
  },
  confidenceBadge: {
    backgroundColor: Colors.gl, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  confidenceText: { ...Typography.badge, color: Colors.g2, fontWeight: '700' },
  jsonBtn: { ...Typography.badge, color: Colors.bt, textDecorationLine: 'underline' },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  linkedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  linkedInvoice: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
  linkedAmount: { ...Typography.bodyLG, fontWeight: '700', color: Colors.g2 },
  integrityCard: {
    margin: Spacing.s4, backgroundColor: Colors.g,
    borderRadius: Radius.lg, padding: Spacing.s5,
  },
  integrityTitle: { ...Typography.titleMD, color: Colors.w, marginBottom: 8 },
  integrityHash: {
    fontFamily: 'Courier New', fontSize: 11, color: 'rgba(255,255,255,0.85)',
    lineHeight: 17,
  },
  metaCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: Spacing.s4,
  },
  metaLabel: { ...Typography.bodySM, color: Colors.t2, flex: 1 },
  metaValue: { ...Typography.bodyMD, color: Colors.t, flex: 2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.gy2, marginHorizontal: Spacing.s4 },
  docPlaceholder: {
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s4,
    height: 160, backgroundColor: Colors.gy2,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  docText: { ...Typography.bodyMD, color: Colors.t2 },
});
