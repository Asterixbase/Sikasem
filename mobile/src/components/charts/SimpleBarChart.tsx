import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants';

interface Bar { label: string; value: number; peak?: boolean }
interface Props { data: Bar[]; maxValue?: number }

export function SimpleBarChart({ data, maxValue }: Props) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);
  return (
    <View style={styles.container}>
      {data.map((bar, i) => (
        <View key={i} style={styles.col}>
          <View style={styles.barWrap}>
            <View style={[
              styles.bar,
              { height: `${(bar.value / max) * 100}%`, backgroundColor: bar.peak ? Colors.g : '#cde8d3' }
            ]} />
          </View>
          <Text style={styles.label}>{bar.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 4, paddingHorizontal: 4 },
  col: { flex: 1, alignItems: 'center' },
  barWrap: { width: '100%', height: 96, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, minHeight: 4 },
  label: { ...Typography.micro, color: Colors.t2, marginTop: 4, textAlign: 'center' },
});
