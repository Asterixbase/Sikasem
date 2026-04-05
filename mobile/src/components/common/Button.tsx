import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { useThemePalette } from '@/store/theme';

type Variant = 'primary' | 'secondary' | 'whatsapp' | 'danger';

interface Props extends PressableProps {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: string;
}

export function Button({ label, variant = 'primary', loading, icon, style, ...props }: Props) {
  const theme = useThemePalette();

  const BG: Record<Variant, string> = {
    primary:   theme.primary,
    secondary: Colors.gy,
    whatsapp:  Colors.wa,
    danger:    Colors.rt,
  };
  const FG: Record<Variant, string> = {
    primary:   Colors.w,
    secondary: Colors.t,
    whatsapp:  Colors.w,
    danger:    Colors.w,
  };

  return (
    <Pressable
      style={[styles.btn, { backgroundColor: BG[variant] }, style as object]}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={FG[variant]} size="small" />
        : <Text style={[styles.text, { color: FG[variant] }]}>{icon ? `${icon} ${label}` : label}</Text>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.sm, paddingVertical: 14, minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.s4, marginVertical: Spacing.s2,
  },
  text: { ...Typography.titleSM },
});
