import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  Button,
  LoadingState,
  ErrorState,
  ChatHeader,
} from '@/components';

interface WAOrderData {
  supplier_name: string;
  supplier_phone: string;
  message: string;
}

const QUICK_CHIPS = [
  'Please confirm prices',
  'Urgent',
  'Cash payment',
  'Weekly order',
  'Delivery to shop',
  'WhatsApp receipt',
];

function buildWaUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export default function WAOrderScreen() {
  const { items } = useLocalSearchParams<{ items?: string }>();
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [initialised, setInitialised] = useState(false);

  const { data, isLoading, error } = useQuery<WAOrderData>({
    queryKey: ['whatsappOrder', items],
    queryFn: () =>
      analyticsApi.whatsappOrder(items ?? '').then(r => r.data),
  });

  // Populate editable message once data arrives (onSuccess removed in TanStack Query v5)
  useEffect(() => {
    if (data && !initialised) {
      setMessage(data.message);
      setInitialised(true);
    }
  }, [data]);

  const appendChip = useCallback((chip: string) => {
    setMessage(prev => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed}\n${chip}` : chip;
    });
  }, []);

  function addNote() {
    if (!note.trim()) return;
    setMessage(prev => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed}\n\n📝 ${note.trim()}` : `📝 ${note.trim()}`;
    });
    setNote('');
  }

  function handleReset() {
    if (data) {
      setMessage(data.message);
      setInitialised(true);
    }
  }

  if (isLoading) return <LoadingState message="Preparing order…" />;
  if (error || !data) return <ErrorState message="Could not load order details" />;

  const waUrl = buildWaUrl(data.supplier_phone, message);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="WhatsApp Order" />

      {/* WhatsApp chat header */}
      <ChatHeader name={data.supplier_name} phone={data.supplier_phone} />

      {/* Recipient bar */}
      <View style={styles.recipientBar}>
        <Text style={styles.recipientLabel}>To: </Text>
        <Text style={styles.recipientName}>{data.supplier_name}</Text>
      </View>

      <ScrollView
        style={styles.chatArea}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Editable outgoing bubble */}
        <View style={styles.bubbleWrap}>
          <View style={styles.bubble}>
            {/* "editable" pill */}
            <View style={styles.editablePill}>
              <Text style={styles.editablePillText}>editable</Text>
            </View>
            <TextInput
              style={styles.bubbleInput}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Your order message…"
              placeholderTextColor={Colors.t2}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Quick-insert chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {QUICK_CHIPS.map(chip => (
            <Pressable key={chip} style={styles.chip} onPress={() => appendChip(chip)}>
              <Text style={styles.chipText}>{chip}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Add note field */}
        <View style={styles.noteRow}>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note…"
            placeholderTextColor={Colors.t2}
            returnKeyType="done"
            onSubmitEditing={addNote}
          />
          <Pressable style={styles.addBtn} onPress={addNote}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {/* Live wa.me link */}
        <View style={styles.waLinkBox}>
          <Text style={styles.waLinkLabel}>wa.me link preview</Text>
          <Text style={styles.waLinkText} numberOfLines={2}>{waUrl}</Text>
        </View>

        {/* Action buttons */}
        <Button
          label="Open in WhatsApp"
          variant="whatsapp"
          icon="💬"
          onPress={() => Linking.openURL(waUrl)}
        />
        <Button
          label="Reset"
          variant="secondary"
          onPress={handleReset}
        />
        <Button
          label="Edit Items"
          variant="secondary"
          onPress={() => router.push('/(main)/reorder')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.waChatBg },
  recipientBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gy,
    paddingHorizontal: Spacing.s5,
    paddingVertical: Spacing.s2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
  },
  recipientLabel: { ...Typography.bodySM, color: Colors.t2 },
  recipientName: { ...Typography.titleSM, color: Colors.t },
  chatArea: { flex: 1 },
  bubbleWrap: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.s4,
    paddingTop: Spacing.s4,
  },
  bubble: {
    backgroundColor: Colors.waBubbleOut,
    borderRadius: Radius.md,
    borderTopRightRadius: 0,
    maxWidth: '90%',
    minWidth: '70%',
    padding: Spacing.s3,
    ...Shadows.card,
    position: 'relative',
  },
  editablePill: {
    position: 'absolute',
    top: -10,
    right: 8,
    backgroundColor: Colors.a,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.at,
    zIndex: 1,
  },
  editablePillText: { ...Typography.micro, color: Colors.at, fontWeight: '700' },
  bubbleInput: {
    ...Typography.bodyMD,
    color: Colors.t,
    backgroundColor: 'transparent',
    minHeight: 100,
    paddingTop: Spacing.s3,
  },
  chipsRow: {
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s3,
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.w,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.gy2,
    marginRight: 6,
  },
  chipText: { ...Typography.badge, color: Colors.t },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s3,
    gap: Spacing.s2,
  },
  noteInput: {
    flex: 1,
    backgroundColor: Colors.w,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.gy2,
    paddingHorizontal: Spacing.s3,
    paddingVertical: Spacing.s2,
    ...Typography.bodyMD,
    color: Colors.t,
  },
  addBtn: {
    backgroundColor: Colors.g,
    borderRadius: Radius.sm,
    paddingHorizontal: 16,
    paddingVertical: Spacing.s2,
  },
  addBtnText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  waLinkBox: {
    marginHorizontal: Spacing.s4,
    marginBottom: Spacing.s3,
    backgroundColor: Colors.gy,
    borderRadius: Radius.sm,
    padding: Spacing.s2,
    borderWidth: 1,
    borderColor: Colors.gy2,
  },
  waLinkLabel: { ...Typography.micro, color: Colors.t2, marginBottom: 2 },
  waLinkText: { ...Typography.micro, color: Colors.t2, fontFamily: 'Courier New' },
});
