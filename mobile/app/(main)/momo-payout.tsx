import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { vaultApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { ScreenHeader, SafeScrollView, HeroCard, Button, FormInput, LoadingState, ErrorState } from '@/components';

type Network = 'mtn' | 'telecel';

export default function MomoPayoutScreen() {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<Network>('mtn');

  const { data, isLoading, error } = useQuery({
    queryKey: ['vault-balance'],
    queryFn: () => vaultApi.balance().then(r => r.data),
  });

  const { mutate: sendPayout, isPending } = useMutation({
    mutationFn: () => {
      const pesawas = Math.round(parseFloat(amount) * 100);
      return vaultApi.payout({ amount_pesawas: pesawas, recipient_phone: phone, network });
    },
    onSuccess: () => {
      Alert.alert('Payout Sent', 'MoMo payout has been initiated');
      router.push('/(main)/payout-history');
    },
    onError: () => Alert.alert('Error', 'Payout failed. Please try again.'),
  });

  if (isLoading) return <LoadingState message="Loading vault…" />;
  if (error) return <ErrorState message="Could not load vault balance" />;

  const available: number = data?.available_pesawas ?? 1080000;
  const availableGHS = (available / 100).toFixed(2);

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payout amount');
      return;
    }
    if (parseFloat(amount) * 100 > available) {
      Alert.alert('Insufficient funds', 'Amount exceeds available balance');
      return;
    }
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid phone', 'Please enter a valid recipient phone number');
      return;
    }
    Alert.alert(
      'Confirm Payout',
      `Send GHS ${amount} to ${phone} via ${network.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => sendPayout() },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="MoMo Payout" />
      <SafeScrollView>
        {/* Hero */}
        <HeroCard
          label="AVAILABLE FOR PAYOUT"
          amount={available}
        />

        {/* Amount input */}
        <Text style={styles.sectionHeader}>AMOUNT</Text>
        <View style={styles.amountRow}>
          <View style={styles.amountInputWrapper}>
            <Text style={styles.ghsPrefix}>GHS</Text>
            <FormInput
              label=""
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              style={styles.amountInput}
            />
          </View>
          <Pressable
            style={styles.maxBtn}
            onPress={() => setAmount(availableGHS)}
          >
            <Text style={styles.maxBtnText}>MAX</Text>
          </Pressable>
        </View>

        {/* Recipient */}
        <Text style={styles.sectionHeader}>RECIPIENT</Text>
        <View style={styles.recipientCard}>
          <FormInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+233 XX XXX XXXX"
          />
          {phone.length >= 10 && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified: Kwame Osei</Text>
            </View>
          )}
        </View>

        {/* Network selector */}
        <Text style={styles.sectionHeader}>NETWORK</Text>
        <View style={styles.networkRow}>
          <Pressable
            style={[styles.networkCard, network === 'mtn' && styles.networkActive]}
            onPress={() => setNetwork('mtn')}
          >
            <Text style={styles.networkEmoji}>📱</Text>
            <Text style={[styles.networkName, network === 'mtn' && styles.networkNameActive]}>MTN</Text>
            <Text style={styles.networkSub}>MoMo</Text>
          </Pressable>
          <Pressable
            style={[styles.networkCard, network === 'telecel' && styles.networkActive]}
            onPress={() => setNetwork('telecel')}
          >
            <Text style={styles.networkEmoji}>📲</Text>
            <Text style={[styles.networkName, network === 'telecel' && styles.networkNameActive]}>Telecel</Text>
            <Text style={styles.networkSub}>Cash</Text>
          </Pressable>
        </View>

        {/* Security note */}
        <View style={styles.secNote}>
          <Text style={styles.secText}>🔒 256-bit encryption · All transactions secured</Text>
        </View>

        {/* Confirm button */}
        <Button
          label="Confirm Payout →"
          variant="primary"
          loading={isPending}
          onPress={handleConfirm}
        />
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  sectionHeader: {
    ...Typography.label, color: Colors.t2,
    paddingHorizontal: Spacing.s4, paddingTop: Spacing.s4, paddingBottom: Spacing.s2,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.s4, gap: 8,
  },
  amountInputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.w, borderRadius: Radius.lg,
    paddingLeft: Spacing.s3, ...Shadows.card,
    borderBottomWidth: 2, borderBottomColor: Colors.g,
  },
  ghsPrefix: { ...Typography.titleMD, color: Colors.g2, marginRight: 4 },
  amountInput: { flex: 1 },
  maxBtn: {
    backgroundColor: Colors.gl, borderRadius: Radius.sm,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.g,
  },
  maxBtnText: { ...Typography.badge, color: Colors.g2, fontWeight: '700' },
  recipientCard: {
    marginHorizontal: Spacing.s4, backgroundColor: Colors.w,
    borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card,
  },
  verifiedBadge: {
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    backgroundColor: Colors.gl, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  verifiedText: { ...Typography.badge, color: Colors.g2 },
  networkRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.s4, gap: 12,
  },
  networkCard: {
    flex: 1, backgroundColor: Colors.w, borderRadius: Radius.lg,
    padding: Spacing.s4, alignItems: 'center', ...Shadows.card,
    borderWidth: 2, borderColor: Colors.gy2,
  },
  networkActive: { borderColor: '#FFB300' },
  networkEmoji: { fontSize: 28, marginBottom: 4 },
  networkName: { ...Typography.titleMD, color: Colors.t },
  networkNameActive: { color: '#FFB300' },
  networkSub: { ...Typography.bodySM, color: Colors.t2 },
  secNote: {
    margin: Spacing.s4, alignItems: 'center',
  },
  secText: { ...Typography.bodySM, color: Colors.t2 },
});
