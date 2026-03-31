import React from 'react';
import { Text, TextStyle } from 'react-native';
import { Colors, Typography } from '@/constants';

interface Props { pesawas: number; style?: TextStyle; large?: boolean }

export function GHSAmount({ pesawas, style, large }: Props) {
  const ghs = (pesawas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return (
    <Text style={[large ? Typography.displayMD : Typography.titleMD, { color: Colors.g }, style]}>
      GHS {ghs}
    </Text>
  );
}
