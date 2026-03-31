import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

interface Props {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  onPress?: () => void;
}

export function MetricTile({ label, value, change, positive, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {change ? (
        <Text style={[styles.change, { color: positive ? Colors.g : Colors.rt }]}>{change}</Text>
      ) : null}
      {onPress ? <Text style={styles.arrow}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1, backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s3, margin: 4, ...Shadows.card,
  },
  value: { ...Typography.titleMD, color: Colors.t },
  label: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  change: { ...Typography.badge, marginTop: 4 },
  arrow: { position: 'absolute', top: 8, right: 10, fontSize: 16, color: Colors.t2 },
});
