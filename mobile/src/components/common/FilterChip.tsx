import React from 'react';
import { Pressable, Text, StyleSheet, ScrollView, View } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants';

interface ChipProps { label: string; active: boolean; onPress: () => void }

export function FilterChip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={6}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

interface ChipBarProps { chips: { label: string; value: string }[]; active: string; onChange: (v: string) => void }
export function ChipBar({ chips, active, onChange }: ChipBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.barOuter}
      contentContainerStyle={styles.bar}
    >
      {chips.map(c => (
        <FilterChip key={c.value} label={c.label} active={active === c.value} onPress={() => onChange(c.value)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.w, borderWidth: 1, borderColor: Colors.gy2,
    marginRight: 6,
  },
  chipActive: { backgroundColor: Colors.g, borderColor: Colors.g },
  text: { ...Typography.badge, color: Colors.t2 },
  textActive: { color: Colors.w },
  barOuter: { flexGrow: 0, flexShrink: 0 },
  bar: { paddingHorizontal: Spacing.s4, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
});
