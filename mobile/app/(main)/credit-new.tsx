import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { creditApi } from '@/api';
import {
  ScreenHeader, Button, FormInput, Badge,
} from '@/components';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';

type IdType = 'ghana_card' | 'passport' | 'voter';

const ID_TYPE_LABELS: Record<IdType, string> = {
  ghana_card: 'Ghana Card',
  passport: 'Passport',
  voter: 'Voter ID',
};

export default function CreditNewScreen() {
  const [name, setName] = useState('');
  const [idType, setIdType] = useState<IdType>('ghana_card');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      creditApi.createCustomer({
        full_name: name.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
        phone: phone.trim(),
      }),
    onSuccess: (res) => {
      router.push({
        pathname: '/(main)/credit-step2',
        params: {
          customer_id: res.data?.id ?? res.data?.customer_id,
          customer_name: name.trim(),
          id_type: idType,
          id_number: idNumber.trim(),
        },
      });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.detail ?? 'Could not save customer'),
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!idNumber.trim()) errs.idNumber = 'ID number is required';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinueManually = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  const handleScanId = () => {
    router.push('/(main)/id-scan' as any);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="New credit sale"
        subtitle="STEP 1 OF 2"
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
          <Badge label="STEP 1 OF 2" variant="green" />
        </View>

        {/* Camera scan box */}
        <Pressable style={styles.scanBox} onPress={handleScanId}>
          <Text style={styles.scanIcon}>📷</Text>
          <Text style={styles.scanLabel}>Ghana Card / Passport</Text>
          <Text style={styles.scanSub}>Tap to scan ID document</Text>
        </Pressable>

        <Text style={styles.dividerText}>— or enter manually —</Text>

        {/* Manual form */}
        <View style={styles.form}>
          <FormInput
            label="FULL NAME"
            placeholder="e.g. Kwame Osei Mensah"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
          />

          {/* ID Type picker */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>ID TYPE</Text>
            <View style={styles.idTypeRow}>
              {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setIdType(t)}
                  style={[styles.idTypeBtn, idType === t && styles.idTypeBtnActive]}
                >
                  <Text style={[styles.idTypeBtnText, idType === t && styles.idTypeBtnTextActive]}>
                    {ID_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <FormInput
            label="ID NUMBER"
            placeholder="e.g. GHA-123456789-0"
            value={idNumber}
            onChangeText={setIdNumber}
            error={errors.idNumber}
            autoCapitalize="characters"
          />

          <FormInput
            label="PHONE NUMBER"
            placeholder="024 XXX XXXX"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Buttons */}
        <Button
          label="Scan ID →"
          variant="secondary"
          onPress={handleScanId}
        />
        <Button
          label="Continue manually →"
          variant="primary"
          loading={mutation.isPending}
          onPress={handleContinueManually}
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
  scanBox: {
    margin: Spacing.s4,
    padding: Spacing.s6,
    borderWidth: 2,
    borderColor: Colors.g,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
    alignItems: 'center',
    backgroundColor: Colors.gx,
    gap: Spacing.s2,
  },
  scanIcon: { fontSize: 32 },
  scanLabel: { ...Typography.titleSM, color: Colors.g },
  scanSub: { ...Typography.bodySM, color: Colors.t2 },
  dividerText: {
    ...Typography.bodySM, color: Colors.t2,
    textAlign: 'center', marginVertical: Spacing.s3,
  },
  form: { paddingHorizontal: Spacing.s4 },
  fieldWrap: { marginBottom: Spacing.s3 },
  fieldLabel: { ...Typography.label, color: Colors.t2, marginBottom: Spacing.s1 },
  idTypeRow: { flexDirection: 'row', gap: Spacing.s2 },
  idTypeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.gy2,
    alignItems: 'center', backgroundColor: Colors.w,
  },
  idTypeBtnActive: { backgroundColor: Colors.g, borderColor: Colors.g },
  idTypeBtnText: { ...Typography.badge, color: Colors.t2 },
  idTypeBtnTextActive: { color: Colors.w },
});
