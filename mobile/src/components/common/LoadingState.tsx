import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants';

interface Props { message?: string }

export function LoadingState({ message = 'Loading…' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.g} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Text onPress={onRetry} style={styles.retryText}>Try again</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  text: { ...Typography.bodyMD, color: Colors.t2, marginTop: 12 },
  errorText: { ...Typography.bodyMD, color: Colors.rt, textAlign: 'center' },
  retryText: { ...Typography.bodyMD, color: Colors.g, marginTop: 12 },
});
