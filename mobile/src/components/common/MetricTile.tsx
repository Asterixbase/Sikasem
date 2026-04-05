import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { screenPad, isSmallScreen } from '@/utils/layout';

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
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      {change ? (
        <Text style={[styles.change, { color: positive ? Colors.g : Colors.rt }]} numberOfLines={1}>
          {change}
        </Text>
      ) : null}
      {onPress ? <Text style={styles.arrow}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.w,
    borderRadius: Radius.lg,
    padding: isSmallScreen ? Spacing.s2 : Spacing.s3,
    margin: 4,
    minHeight: 80,
    ...Shadows.card,
  },
  value: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    lineHeight: 26,
    color: Colors.t,
  },
  label: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  change: { ...Typography.micro, marginTop: 4 },
  arrow: { position: 'absolute', top: 8, right: 10, fontSize: 16, color: Colors.t2 },
});
