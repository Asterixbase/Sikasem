import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, Badge, ChipBar, LoadingState, ErrorState } from '@/components';

type AccessFilter = 'logins' | 'alerts' | 'role';
type EventSeverity = 'success' | 'warning' | 'critical';

interface AccessEvent {
  id: string;
  name: string;
  initials: string;
  event_type: string;
  description: string;
  timestamp: string;
  severity: EventSeverity;
  day: 'today' | 'yesterday';
}

const MOCK_EVENTS: AccessEvent[] = [
  {
    id: '1', name: 'Ama Mensah', initials: 'AM',
    event_type: 'LOGIN', description: 'Successful login from Accra Central, Ghana',
    timestamp: '09:14 AM', severity: 'success', day: 'today',
  },
  {
    id: '2', name: 'Kofi Arhin', initials: 'KA',
    event_type: 'MFA CHALLENGE', description: 'MFA required — new device detected',
    timestamp: '08:52 AM', severity: 'warning', day: 'today',
  },
  {
    id: '3', name: 'Ama Mensah', initials: 'AM',
    event_type: 'PASSWORD CHANGE', description: 'Password changed successfully',
    timestamp: '08:30 AM', severity: 'warning', day: 'today',
  },
  {
    id: '4', name: 'Unknown User', initials: '??',
    event_type: 'FAILED MFA', description: 'MFA failed 3 times — IP blocked temporarily',
    timestamp: '27 Mar · 11:45 PM', severity: 'critical', day: 'yesterday',
  },
  {
    id: '5', name: 'Yuki Tanaka', initials: 'YT',
    event_type: 'LOGOUT', description: 'Session ended normally',
    timestamp: '27 Mar · 06:15 PM', severity: 'success', day: 'yesterday',
  },
];

function borderColor(sev: EventSeverity): string {
  return Colors.severity[sev] ?? Colors.t2;
}

function badgeVariant(sev: EventSeverity): 'green' | 'amber' | 'red' {
  if (sev === 'success') return 'green';
  if (sev === 'warning') return 'amber';
  return 'red';
}

function avatarBg(sev: EventSeverity): string {
  if (sev === 'success') return Colors.g;
  if (sev === 'warning') return Colors.at;
  return Colors.rt;
}

export default function AccessLogsScreen() {
  const [filter, setFilter] = useState<AccessFilter>('logins');

  const { data, isLoading, error } = useQuery({
    queryKey: ['access-logs', filter],
    queryFn: () => adminApi.accessLogs(filter).then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading access logs…" />;
  if (error) return <ErrorState message="Could not load access logs" />;

  const events: AccessEvent[] = data?.events ?? MOCK_EVENTS;

  const todayEvents = events.filter(e => e.day === 'today');
  const yesterdayEvents = events.filter(e => e.day === 'yesterday');

  const renderEvent = (ev: AccessEvent, idx: number, arr: AccessEvent[]) => (
    <View
      key={ev.id}
      style={[
        styles.eventCard,
        { borderLeftColor: borderColor(ev.severity) },
        idx === arr.length - 1 && styles.lastCard,
      ]}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarBg(ev.severity) }]}>
        <Text style={styles.avatarText}>{ev.initials}</Text>
      </View>
      {/* Content */}
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventName}>{ev.name}</Text>
          <Badge label={ev.event_type} variant={badgeVariant(ev.severity)} />
        </View>
        <Text style={styles.eventDesc} numberOfLines={2}>{ev.description}</Text>
        <Text style={styles.eventTime}>{ev.timestamp}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Access Logs"
        subtitle="SYSTEM AUDIT / Security Feed — Today"
      />
      <ChipBar
        chips={[
          { label: 'Logins', value: 'logins' },
          { label: 'Security Alerts', value: 'alerts' },
          { label: 'Role: Admin', value: 'role' },
        ]}
        active={filter}
        onChange={v => setFilter(v as AccessFilter)}
      />
      <SafeScrollView>
        {/* Today */}
        {todayEvents.length > 0 && (
          <>
            <Text style={styles.dayDivider}>TODAY</Text>
            <View style={styles.eventList}>
              {todayEvents.map((ev, idx, arr) => renderEvent(ev, idx, arr))}
            </View>
          </>
        )}

        {/* Yesterday */}
        {yesterdayEvents.length > 0 && (
          <>
            <Text style={styles.dayDivider}>YESTERDAY</Text>
            <View style={styles.eventList}>
              {yesterdayEvents.map((ev, idx, arr) => renderEvent(ev, idx, arr))}
            </View>
          </>
        )}

        {events.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No access events found</Text>
          </View>
        )}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  dayDivider: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  eventList: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
    marginBottom: Spacing.s3,
  },
  eventCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: Spacing.s4, borderLeftWidth: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  lastCard: { borderBottomWidth: 0 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.s3, flexShrink: 0,
  },
  avatarText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  eventContent: { flex: 1 },
  eventHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 3,
  },
  eventName: { ...Typography.bodyLG, color: Colors.t },
  eventDesc: { ...Typography.bodyMD, color: Colors.t2, lineHeight: 18 },
  eventTime: { ...Typography.bodySM, color: Colors.t2, marginTop: 3 },
  empty: { padding: Spacing.s8, alignItems: 'center' },
  emptyText: { ...Typography.bodyMD, color: Colors.t2 },
});
