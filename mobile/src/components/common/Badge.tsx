import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BadgeColors, Typography, Radius } from '@/constants';

type Variant = 'green' | 'amber' | 'red' | 'blue';

interface Props { label: string; variant?: Variant }

export function Badge({ label, variant = 'green' }: Props) {
  const { bg, text } = BadgeColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  text: { ...Typography.badge },
});
