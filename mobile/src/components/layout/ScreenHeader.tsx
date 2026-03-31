import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors, Typography, Spacing } from '@/constants';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack = true, onBack, right }: Props) {
  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          style={styles.back}
          hitSlop={8}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.s4, paddingVertical: 10,
    backgroundColor: Colors.w, borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  back: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.gy, alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: Colors.t, lineHeight: 26, marginTop: -1 },
  placeholder: { width: 32 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { ...Typography.titleSM, color: Colors.t },
  subtitle: { ...Typography.bodySM, color: Colors.t2, marginTop: 1 },
  right: { width: 32, alignItems: 'flex-end' },
});
