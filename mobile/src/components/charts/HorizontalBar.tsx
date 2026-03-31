import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants';

interface Props { label: string; value: string | number; pct: number; color?: string }

export function HorizontalBar({ label, value, pct, color = Colors.g }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: Spacing.s3 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { ...Typography.bodyMD, color: Colors.t },
  value: { ...Typography.bodyMD, color: Colors.t2 },
  track: { height: 5, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },
});
