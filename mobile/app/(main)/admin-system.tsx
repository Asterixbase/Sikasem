import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader, SafeScrollView, HeroCard, Button,
  LoadingState, ErrorState,
} from '@/components';
import { SimpleBarChart } from '@/components';

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', user: 'Ama Mensah', action: 'Logged in from Accra', timestamp: '09:14 AM' },
  { id: '2', user: 'System', action: 'OCR batch completed — 14 invoices', timestamp: '09:02 AM' },
  { id: '3', user: 'Kofi Arhin', action: 'Processed sale GHS 124.00', timestamp: '08:55 AM' },
  { id: '4', user: 'System', action: 'Daily backup completed', timestamp: '08:00 AM' },
];

const OCR_BARS = [
  { label: 'Mon', value: 0.9 },
  { label: 'Tue', value: 1.1 },
  { label: 'Wed', value: 1.4 },
  { label: 'Thu', value: 0.8 },
  { label: 'Fri', value: 1.2 },
  { label: 'Sat', value: 1.0 },
  { label: 'Sun', value: 1.6 },
];

export default function AdminSystemScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: () => adminApi.systemHealth().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading system health…" />;
  if (error) return <ErrorState message="Could not load system data" />;

  const d = data ?? {};
  const uptime: string = d.uptime_pct ?? '99.98%';
  const activeNodes: number = d.active_nodes ?? 12;
  const syncMs: number = d.sync_ms ?? 12;
  const dbMs: number = d.db_latency_ms ?? 45;
  const activity: ActivityItem[] = d.staff_activity ?? MOCK_ACTIVITY;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Sikasem ADMIN" subtitle="Infrastructure Status / System Health" />
      <SafeScrollView>
        {/* Uptime hero */}
        <HeroCard
          label="SYSTEM UPTIME"
          value={uptime}
          subtitle={`ACTIVE NODES: ${activeNodes} / REGION: WEST AFRICA`}
        />

        {/* OCR speed chart */}
        <Text style={styles.sectionHeader}>OCR PROCESSING SPEED</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Processing Time (seconds)</Text>
            <Text style={styles.chartAvg}>1.2s avg</Text>
          </View>
          <SimpleBarChart
            data={OCR_BARS.map(b => ({ label: b.label, value: b.value }))}
            maxValue={2}
            height={80}
          />
        </View>

        {/* Network performance */}
        <Text style={styles.sectionHeader}>NETWORK PERFORMANCE</Text>
        <View style={styles.netCard}>
          <View style={styles.netRow}>
            <View style={[styles.statusDot, { backgroundColor: Colors.g }]} />
            <Text style={styles.netLabel}>Real-time Sync</Text>
            <Text style={styles.netValue}>{syncMs}ms</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.netRow}>
            <View style={[styles.statusDot, { backgroundColor: Colors.rt }]} />
            <Text style={styles.netLabel}>Database Latency</Text>
            <Text style={styles.netValue}>{dbMs}ms</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
        <View style={styles.actionBtns}>
          <Button
            label="Add Staff"
            variant="secondary"
            onPress={() => Alert.alert('Add Staff', 'Staff invitation coming soon')}
          />
          <Button
            label="View System Logs"
            variant="secondary"
            onPress={() => router.push('/(main)/system-logs')}
          />
          <Button
            label="Run Security Audit"
            variant="primary"
            onPress={() => router.push('/(main)/security-audit')}
          />
        </View>

        {/* Staff activity stream */}
        <Text style={styles.sectionHeader}>STAFF ACTIVITY</Text>
        <View style={styles.activityList}>
          {activity.map((item, idx) => (
            <Pressable
              key={item.id}
              style={[styles.activityRow, idx === activity.length - 1 && styles.noBorder]}
              onPress={() => router.push('/(main)/access-logs')}
            >
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={styles.activityUser}>{item.user}</Text>
                <Text style={styles.activityAction}>{item.action}</Text>
              </View>
              <Text style={styles.activityTime}>{item.timestamp}</Text>
            </Pressable>
          ))}
        </View>
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  chartCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, padding: Spacing.s4, ...Shadows.card,
  },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.s3,
  },
  chartTitle: { ...Typography.bodyMD, color: Colors.t2 },
  chartAvg: { ...Typography.badge, color: Colors.g2, fontWeight: '700' },
  netCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  netRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.s4,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.s3 },
  netLabel: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
  netValue: { ...Typography.bodyLG, fontWeight: '700', color: Colors.t },
  divider: { height: 1, backgroundColor: Colors.gy2, marginHorizontal: Spacing.s4 },
  actionBtns: {},
  activityList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s4, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  noBorder: { borderBottomWidth: 0 },
  activityDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.g,
    marginRight: Spacing.s3,
  },
  activityContent: { flex: 1 },
  activityUser: { ...Typography.bodyLG, color: Colors.t },
  activityAction: { ...Typography.bodySM, color: Colors.t2, marginTop: 1 },
  activityTime: { ...Typography.bodySM, color: Colors.t2 },
});
