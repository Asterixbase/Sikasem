import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function FormInput({ label, error, style, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={Colors.t2}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.s3 },
  label: { ...Typography.label, color: Colors.t2, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: Colors.gy2, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 11,
    ...Typography.bodyLG, color: Colors.t, backgroundColor: Colors.w,
  },
  inputError: { borderColor: Colors.rt },
  error: { ...Typography.bodySM, color: Colors.rt, marginTop: 4 },
});
