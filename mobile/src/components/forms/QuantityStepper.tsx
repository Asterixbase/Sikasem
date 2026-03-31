import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants';

interface Props { value: number; onChange: (v: number) => void; min?: number; max?: number }

export function QuantityStepper({ value, onChange, min = 0, max = 9999 }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[styles.btn, styles.minus]}
        hitSlop={8}
      >
        <Text style={[styles.icon, { color: Colors.rt }]}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[styles.btn, styles.plus]}
        hitSlop={8}
      >
        <Text style={[styles.icon, { color: Colors.g }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  minus: { backgroundColor: Colors.r },
  plus:  { backgroundColor: Colors.gl },
  icon: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  value: { ...Typography.titleMD, minWidth: 32, textAlign: 'center' },
});
