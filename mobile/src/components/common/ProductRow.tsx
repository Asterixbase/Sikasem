import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { Badge } from './Badge';

interface Props {
  emoji?: string;
  name: string;
  sub?: string;
  price?: number;         // pesawas
  badge?: string;
  badgeVariant?: 'green' | 'amber' | 'red' | 'blue';
  onPress?: () => void;
}

export function ProductRow({ emoji, name, sub, price, badge, badgeVariant = 'green', onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      {emoji ? (
        <View style={styles.avatar}><Text style={styles.emoji}>{emoji}</Text></View>
      ) : null}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <View style={styles.right}>
        {price !== undefined ? (
          <Text style={styles.price}>
            GHS {(price / 100).toFixed(2)}
          </Text>
        ) : null}
        {badge ? <Badge label={badge} variant={badgeVariant} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.s3, backgroundColor: Colors.w,
    borderBottomWidth: 1, borderBottomColor: Colors.gy,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 9, backgroundColor: Colors.gy,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.s3,
  },
  emoji: { fontSize: 20 },
  info: { flex: 1 },
  name: { ...Typography.bodyLG, color: Colors.t },
  sub: { ...Typography.bodySM, color: Colors.t2 },
  right: { alignItems: 'flex-end', gap: 4 },
  price: { ...Typography.bodyLG, color: Colors.t },
});
