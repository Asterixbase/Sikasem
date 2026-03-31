import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

interface Props {
  label: string;
  amount?: number;     // pesawas — auto-formats as GHS X,XXX.XX
  value?: string;      // raw string override
  subtitle?: string;
  badge?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function HeroCard({ label, amount, value, subtitle, badge, style, children }: Props) {
  const display = amount !== undefined
    ? `GHS ${(amount / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
    : (value ?? '');

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{display}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.g, borderRadius: Radius.xl,
    padding: Spacing.s6, margin: Spacing.s4, ...Shadows.card,
  },
  label: { ...Typography.label, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  amount: { ...Typography.displayMD, color: Colors.w },
  sub: { ...Typography.bodySM, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  badge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
  },
  badgeText: { ...Typography.badge, color: Colors.w },
});
