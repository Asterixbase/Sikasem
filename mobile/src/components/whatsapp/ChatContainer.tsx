import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/constants';

interface HeaderProps { name: string; phone: string }
export function ChatHeader({ name, phone }: HeaderProps) {
  const initials = name.split(' ').slice(0,2).map(w => w[0].toUpperCase()).join('');
  return (
    <View style={styles.header}>
      <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
      <View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.phone}>{phone}</Text>
      </View>
    </View>
  );
}

interface BubbleProps { message: string; type: 'incoming' | 'outgoing' }
export function ChatBubble({ message, type }: BubbleProps) {
  const isOut = type === 'outgoing';
  return (
    <View style={[styles.bubbleWrap, isOut && styles.bubbleWrapOut]}>
      <View style={[styles.bubble, isOut ? styles.bubbleOut : styles.bubbleIn]}>
        <Text style={styles.bubbleText}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#075E54', flexDirection: 'row', alignItems: 'center',
    padding: 10, gap: 10,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  initials: { color: Colors.w, fontWeight: '700', fontSize: 13 },
  name: { color: Colors.w, fontWeight: '700', fontSize: 14 },
  phone: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  bubbleWrap: { padding: 10, paddingBottom: 0 },
  bubbleWrapOut: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '88%', padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  bubbleIn:  { backgroundColor: '#ffffff', borderRadius: Radius.md,
               borderTopLeftRadius: 0 },
  bubbleOut: { backgroundColor: '#dcf8c6', borderRadius: Radius.md,
               borderTopRightRadius: 0 },
  bubbleText: { ...Typography.bodyMD, color: Colors.t, lineHeight: 18 },
});
