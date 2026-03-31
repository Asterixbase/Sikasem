import React from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { creditApi } from '@/api';
import {
  ScreenHeader, SafeScrollView, Button,
  ChatHeader, ChatBubble, LoadingState, ErrorState,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GH', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export default function WhatsAppScreen() {
  const params = useLocalSearchParams<{
    sale_id?: string;
    customer_name?: string;
    amount_pesawas?: string;
    due_date?: string;
  }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['whatsapp', params.sale_id],
    queryFn: () =>
      params.sale_id
        ? creditApi.whatsapp(params.sale_id).then(r => r.data)
        : Promise.resolve(null),
    enabled: !!params.sale_id,
  });

  // Fallback message if API not ready or no sale_id
  const amountPesawas = parseInt(params.amount_pesawas ?? '0', 10);
  const formattedAmount = `GHS ${(amountPesawas / 100).toFixed(2)}`;
  const dueFormatted = params.due_date ? formatDate(params.due_date) : '—';

  const fallbackMessage =
    `Hello ${params.customer_name ?? 'Customer'},\n\n` +
    `This is a reminder that your credit purchase of *${formattedAmount}* is due on *${dueFormatted}*.\n\n` +
    `Kindly arrange payment at your earliest convenience.\n\n` +
    `Thank you for shopping with us! 🌿`;

  const messageText = data?.message_text ?? fallbackMessage;
  const recipientPhone = data?.recipient_phone ?? '';
  const recipientName = data?.recipient_name ?? params.customer_name ?? 'Customer';

  const handleOpenWhatsApp = () => {
    const phone = recipientPhone.replace(/\D/g, '');
    if (!phone) {
      Alert.alert('No phone', 'No recipient phone number available');
      return;
    }
    const encoded = encodeURIComponent(messageText);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open WhatsApp')
    );
  };

  if (isLoading && params.sale_id) {
    return <LoadingState message="Preparing WhatsApp message…" />;
  }

  if (error && params.sale_id) {
    return <ErrorState message="Could not load message" onRetry={refetch} />;
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="WhatsApp Reminder"
        subtitle="CREDIT NOTIFICATION"
        onBack={() => router.back()}
      />

      {/* Recipient bar */}
      <View style={styles.recipientBar}>
        <Text style={styles.recipientLabel}>TO:</Text>
        <Text style={styles.recipientName}>{recipientName}</Text>
        {recipientPhone ? (
          <Text style={styles.recipientPhone}>{recipientPhone}</Text>
        ) : null}
      </View>

      {/* WhatsApp chat area */}
      <View style={styles.chatArea}>
        {/* Chat header (WhatsApp green) */}
        <ChatHeader name={recipientName} phone={recipientPhone || '—'} />

        {/* Chat body */}
        <View style={styles.chatBody}>
          {/* Incoming bubble — message is NOT editable */}
          <ChatBubble message={messageText} type="incoming" />
          <Text style={styles.deliveredNote}>Credit reminder · auto-generated</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label="Open in WhatsApp"
          variant="whatsapp"
          onPress={handleOpenWhatsApp}
        />
        <Button
          label="Done"
          variant="secondary"
          onPress={() => router.replace('/(main)/credit-list')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  recipientBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w,
    paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s3,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
    gap: Spacing.s2,
  },
  recipientLabel: { ...Typography.label, color: Colors.t2 },
  recipientName: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
  recipientPhone: { ...Typography.bodySM, color: Colors.t2 },
  chatArea: {
    flex: 1,
    backgroundColor: '#ece5dd', // WhatsApp chat background
    overflow: 'hidden',
  },
  chatBody: {
    flex: 1, paddingVertical: Spacing.s3,
  },
  deliveredNote: {
    ...Typography.micro, color: Colors.t2,
    textAlign: 'right',
    paddingRight: Spacing.s4,
    paddingTop: 3,
  },
  actions: {
    backgroundColor: Colors.w,
    borderTopWidth: 1, borderTopColor: Colors.gy2,
    paddingTop: Spacing.s2, paddingBottom: Spacing.s4,
  },
});
