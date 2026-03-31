import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { Button } from '@/components';

export default function SaleOkScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.circle}><Text style={{ fontSize: 40 }}>✓</Text></View>
        <Text style={styles.title}>Sale confirmed!</Text>
        <Text style={styles.sub}>Stock updated automatically</Text>
        {saleId ? <Text style={styles.ref}>Ref: {saleId}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Button label="New Sale" variant="secondary" onPress={() => router.replace('/(main)/sale')} />
        <Button label="Done" onPress={() => router.replace('/(main)/dash')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.w },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.s8 },
  circle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.gl, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { ...Typography.titleLG, color: Colors.g },
  sub: { ...Typography.bodyMD, color: Colors.t2, marginTop: 8 },
  ref: { ...Typography.badge, color: Colors.t2, marginTop: 12 },
  footer: { padding: Spacing.s4, gap: 8 },
});
