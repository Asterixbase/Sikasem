import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { creditApi } from '@/api';
import {
  ScreenHeader, Button, FormInput, Badge,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

export default function CreditStep2Screen() {
  const params = useLocalSearchParams<{
    customer_id?: string;
    customer_name?: string;
    id_type?: string;
    id_number?: string;
  }>();

  const [amountGHS, setAmountGHS] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [momoPhone, setMomoPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amountGHS);
    if (!amountGHS || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount';
    if (!dueDate.trim()) errs.dueDate = 'Due date is required';
    if (!momoPhone.trim()) errs.momoPhone = 'MoMo phone is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const amountPesawas = Math.round(parseFloat(amountGHS) * 100);
      return creditApi.createSale({
        customer_id: params.customer_id ?? '',
        amount_pesawas: amountPesawas,
        due_date: dueDate,
        momo_auto_request: true,
        items: [],
      });
    },
    onSuccess: (res) => {
      router.push({
        pathname: '/(main)/credit-ok',
        params: {
          sale_id: res.data?.id ?? res.data?.sale_id,
          customer_name: params.customer_name ?? '',
          amount_pesawas: String(Math.round(parseFloat(amountGHS) * 100)),
          due_date: dueDate,
          momo_phone: momoPhone,
        },
      });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.detail ?? 'Could not record credit sale'),
  });

  const handleRecord = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  // Quick date shortcuts for due date
  const addDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="New credit sale"
        subtitle="STEP 2 OF 2"
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step chip */}
        <View style={styles.chipRow}>
          <Badge label="STEP 2 OF 2" variant="green" />
        </View>

        {/* Customer card */}
        <View style={styles.customerCard}>
          <View style={styles.customerCardAccent} />
          <View style={styles.customerCardBody}>
            <Text style={styles.customerName}>{params.customer_name ?? '—'}</Text>
            <Text style={styles.customerId}>
              {params.id_type ? params.id_type.replace('_', ' ').toUpperCase() : 'ID'}: {params.id_number ?? '—'}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <FormInput
            label="GHS AMOUNT"
            placeholder="0.00"
            value={amountGHS}
            onChangeText={setAmountGHS}
            error={errors.amount}
            keyboardType="decimal-pad"
          />

          {/* Due date field */}
          <View style={styles.dateFieldWrap}>
            <Text style={styles.dateLabel}>DUE DATE</Text>
            <FormInput
              placeholder="YYYY-MM-DD"
              value={dueDate}
              onChangeText={setDueDate}
              error={errors.dueDate}
            />
            <View style={styles.dateShortcuts}>
              {[
                { label: '7 days', days: 7 },
                { label: '14 days', days: 14 },
                { label: '30 days', days: 30 },
              ].map(s => (
                <Pressable
                  key={s.days}
                  style={styles.dateShortcut}
                  onPress={() => setDueDate(addDays(s.days))}
                >
                  <Text style={styles.dateShortcutText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <FormInput
            label="MOMO PHONE"
            placeholder="024 XXX XXXX"
            value={momoPhone}
            onChangeText={setMomoPhone}
            error={errors.momoPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Auto-collection banner */}
        <View style={styles.autoBanner}>
          <Text style={styles.autoBannerIcon}>🔄</Text>
          <Text style={styles.autoBannerText}>
            MoMo auto-collection will be queued for due date
          </Text>
        </View>

        <Button
          label="Record credit →"
          variant="primary"
          loading={mutation.isPending}
          onPress={handleRecord}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gy },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  chipRow: {
    paddingHorizontal: Spacing.s4,
    paddingTop: Spacing.s4,
    alignItems: 'flex-start',
  },
  customerCard: {
    flexDirection: 'row',
    margin: Spacing.s4,
    backgroundColor: Colors.w,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.card,
  },
  customerCardAccent: {
    width: 4, backgroundColor: Colors.g,
  },
  customerCardBody: {
    flex: 1, padding: Spacing.s4,
  },
  customerName: { ...Typography.titleSM, color: Colors.t },
  customerId: { ...Typography.bodySM, color: Colors.t2, marginTop: 3 },
  form: { paddingHorizontal: Spacing.s4 },
  dateFieldWrap: { marginBottom: Spacing.s3 },
  dateLabel: { ...Typography.label, color: Colors.t2, marginBottom: Spacing.s1 },
  dateShortcuts: {
    flexDirection: 'row', gap: Spacing.s2, marginTop: Spacing.s1,
  },
  dateShortcut: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.gl, borderRadius: Radius.full,
  },
  dateShortcutText: { ...Typography.badge, color: Colors.g },
  autoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    marginHorizontal: Spacing.s4, marginBottom: Spacing.s3,
    backgroundColor: Colors.gl, borderRadius: Radius.md,
    padding: Spacing.s3,
  },
  autoBannerIcon: { fontSize: 16 },
  autoBannerText: { ...Typography.bodySM, color: Colors.g, flex: 1 },
});
