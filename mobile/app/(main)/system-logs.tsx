import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Badge, ChipBar, LoadingState, ErrorState } from '@/components';

type LogFilter = 'all' | 'critical' | 'warnings';
type LogSeverity = 'success' | 'warning' | 'critical' | 'info';

interface LogEntry {
  id: string;
  severity: LogSeverity;
  type: string;
  source: string;
  title: string;
  description: string;
  timestamp: string;
}

const MOCK_LOGS: LogEntry[] = [
  {
    id: 'LOG-88421',
    severity: 'success',
    type: 'INVOICE_OCR',
    source: 'OCR Engine',
    title: 'OCR extraction completed',
    description: 'Invoice INV-2026-04821 extracted with 94% average confidence',
    timestamp: '28 Mar 2026 · 09:14:32',
  },
  {
    id: 'LOG-88420',
    severity: 'warning',
    type: 'AUTH',
    source: 'Auth Service',
    title: 'MFA challenge issued',
    description: 'User Kofi Arhin required MFA on login from new device',
    timestamp: '28 Mar 2026 · 08:52:11',
  },
  {
    id: 'LOG-88419',
    severity: 'critical',
    type: 'SECURITY',
    source: 'Security Module',
    title: 'Failed MFA attempt',
    description: 'Unknown user failed MFA 3 times from IP 197.251.x.x',
    timestamp: '27 Mar 2026 · 23:45:07',
  },
  {
    id: 'LOG-88418',
    severity: 'success',
    type: 'BACKUP',
    source: 'Backup Service',
    title: 'Daily backup completed',
    description: 'Full database backup written to Supabase Storage (2.4 MB)',
    timestamp: '27 Mar 2026 · 08:00:01',
  },
  {
    id: 'LOG-88417',
    severity: 'warning',
    type: 'INVENTORY',
    source: 'Inventory',
    title: 'Low stock alert triggered',
    description: '5 SKUs below reorder threshold — Indomie, Milo, Geisha x3',
    timestamp: '26 Mar 2026 · 14:20:18',
  },
];

function borderColor(severity: LogSeverity): string {
  return Colors.severity[severity] ?? Colors.t2;
}

function badgeVariant(severity: LogSeverity): 'green' | 'amber' | 'red' | 'blue' {
  if (severity === 'success') return 'green';
  if (severity === 'warning') return 'amber';
  if (severity === 'critical') return 'red';
  return 'blue';
}

export default function SystemLogsScreen() {
  const [filter, setFilter] = useState<LogFilter>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-logs', filter],
    queryFn: () => adminApi.logs(filter).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading system logs…" />;
  if (error) return <ErrorState message="Could not load logs" />;

  const logs: LogEntry[] = data?.logs ?? MOCK_LOGS;
  const filtered = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'critical') return l.severity === 'critical';
    return l.severity === 'warning';
  });

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="System Logs"
        subtitle="REGISTRY ACTIVITY / Real-time audit trails"
      />
      <ChipBar
        chips={[
          { label: 'All', value: 'all' },
          { label: 'Critical', value: 'critical' },
          { label: 'Warnings', value: 'warnings' },
        ]}
        active={filter}
        onChange={v => setFilter(v as LogFilter)}
      />
      <SafeScrollView>
        <View style={styles.logList}>
          {filtered.map(log => (
            <Pressable
              key={log.id}
              style={[styles.logCard, { borderLeftColor: borderColor(log.severity) }]}
              onPress={() => router.push({ pathname: '/(main)/log-detail', params: { id: log.id } })}
            >
              <View style={styles.logMeta}>
                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                <View style={styles.logChips}>
                  <Badge label={log.type} variant={badgeVariant(log.severity)} />
                  <View style={styles.sourceChip}>
                    <Text style={styles.sourceText}>{log.source}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.logTitle}>{log.title}</Text>
              <Text style={styles.logDesc} numberOfLines={2}>{log.description}</Text>
            </Pressable>
          ))}
        </View>
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No logs match this filter</Text>
          </View>
        )}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  logList: { padding: Spacing.s4, gap: 10 },
  logCard: {
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s4, borderLeftWidth: 4, ...Shadows.card,
  },
  logMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  logTimestamp: { ...Typography.bodySM, color: Colors.t2 },
  logChips: { flexDirection: 'row', gap: 6 },
  sourceChip: {
    backgroundColor: Colors.gy, borderRadius: Radius.xs,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  sourceText: { ...Typography.badge, color: Colors.t2 },
  logTitle: { ...Typography.bodyLG, color: Colors.t, marginBottom: 2 },
  logDesc: { ...Typography.bodyMD, color: Colors.t2, lineHeight: 18 },
  empty: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyMD, color: Colors.t2 },
});
