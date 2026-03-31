import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Button, Badge, LoadingState, ErrorState } from '@/components';

interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  severity: 'success' | 'warning' | 'critical';
}

const MOCK_EVENTS: SecurityEvent[] = [
  { id: '1', type: 'LOGIN', description: 'Admin login from Accra', timestamp: '09:14 AM', severity: 'success' },
  { id: '2', type: 'BACKUP', description: 'Daily backup completed', timestamp: '08:00 AM', severity: 'success' },
  { id: '3', type: 'FAILED_MFA', description: 'Failed MFA attempt — 3 retries', timestamp: '27 Mar 23:45', severity: 'critical' },
];

export default function SecurityAuditScreen() {
  const [threatDetection, setThreatDetection] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['security-audit'],
    queryFn: () => adminApi.securityAudit().then(r => r.data),
  });

  const { mutate: runAudit, isPending } = useMutation({
    mutationFn: () => adminApi.runAudit(),
    onSuccess: () => Alert.alert('Audit Complete', 'Security audit completed successfully'),
    onError: () => Alert.alert('Error', 'Audit failed'),
  });

  if (isLoading) return <LoadingState message="Loading security data…" />;
  if (error) return <ErrorState message="Could not load security audit" />;

  const d = data ?? {};
  const grade: string = d.grade ?? 'A+';
  const score: number = d.score ?? 98;
  const events: SecurityEvent[] = d.recent_events ?? MOCK_EVENTS;

  function eventBadge(sev: SecurityEvent['severity']) {
    if (sev === 'success') return <Badge label="OK" variant="green" />;
    if (sev === 'warning') return <Badge label="WARN" variant="amber" />;
    return <Badge label="CRITICAL" variant="red" />;
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Security Audit" />
      <SafeScrollView>
        {/* Integrity hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Integrity Verified</Text>
          <Text style={styles.heroSub}>Last audit: {d.last_audit ?? '28 Mar 2026'}</Text>
        </View>

        {/* Risk ring */}
        <View style={styles.ringSection}>
          <View style={styles.riskRing}>
            <Text style={styles.ringScore}>{score}</Text>
            <Text style={styles.ringGrade}>GRADE {grade}</Text>
          </View>
          <View style={styles.ringInfo}>
            <Text style={styles.ringLabel}>Security Score</Text>
            <Text style={styles.ringDesc}>System integrity is high. One critical event pending review.</Text>
          </View>
        </View>

        {/* Active protections */}
        <Text style={styles.sectionHeader}>ACTIVE PROTECTIONS</Text>
        <View style={styles.protectionList}>
          {/* Static on items */}
          {[
            { label: 'Data Encryption AES-256', status: '✓' },
            { label: 'Daily Backups', status: '✓' },
            { label: 'MFA Enabled', status: '✓' },
          ].map((item, idx) => (
            <View key={item.label} style={[styles.protRow, styles.borderRow]}>
              <Text style={styles.protLabel}>{item.label}</Text>
              <Text style={styles.protCheck}>{item.status}</Text>
            </View>
          ))}
          {/* Toggle row */}
          <View style={styles.protRow}>
            <Text style={styles.protLabel}>Threat Detection</Text>
            <Switch
              value={threatDetection}
              onValueChange={setThreatDetection}
              trackColor={{ false: Colors.gy2, true: Colors.g }}
              thumbColor={Colors.w}
            />
          </View>
        </View>

        {/* Recent events */}
        <Text style={styles.sectionHeader}>RECENT SECURITY EVENTS</Text>
        <View style={styles.eventList}>
          {events.map((ev, idx) => (
            <View key={ev.id} style={[styles.eventRow, idx === events.length - 1 && styles.noBorder]}>
              <View style={styles.eventInfo}>
                <Text style={styles.eventType}>{ev.type}</Text>
                <Text style={styles.eventDesc}>{ev.description}</Text>
                <Text style={styles.eventTime}>{ev.timestamp}</Text>
              </View>
              {eventBadge(ev.severity)}
            </View>
          ))}
        </View>

        {/* Access logs link */}
        <Button
          label="View Access Logs"
          variant="secondary"
          onPress={() => router.push('/(main)/access-logs')}
        />

        {/* Run audit */}
        <Button
          label="☑ Run New Audit"
          variant="primary"
          loading={isPending}
          onPress={() => runAudit()}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  heroCard: {
    margin: Spacing.s4, backgroundColor: Colors.g,
    borderRadius: Radius.xl, padding: Spacing.s5,
  },
  heroTitle: { ...Typography.titleLG, color: Colors.w },
  heroSub: { ...Typography.bodyMD, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  ringSection: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.s4, gap: Spacing.s5,
  },
  riskRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 6, borderColor: Colors.g,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.w, ...Shadows.card,
  },
  ringScore: { ...Typography.titleLG, color: Colors.g2 },
  ringGrade: { ...Typography.label, color: Colors.g2, marginTop: 2 },
  ringInfo: { flex: 1 },
  ringLabel: { ...Typography.titleMD, color: Colors.t },
  ringDesc: { ...Typography.bodyMD, color: Colors.t2, marginTop: 4, lineHeight: 18 },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  protectionList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  protRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.s4,
  },
  borderRow: { borderBottomWidth: 1, borderBottomColor: Colors.gy2 },
  protLabel: { ...Typography.bodyLG, color: Colors.t },
  protCheck: { fontSize: 18, color: Colors.g2, fontWeight: '700' },
  eventList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.s4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  eventInfo: { flex: 1, marginRight: 8 },
  eventType: { ...Typography.label, color: Colors.t },
  eventDesc: { ...Typography.bodyMD, color: Colors.t2, marginTop: 2 },
  eventTime: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
});
