import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { OTPInput, Button, SikasemLogo } from '@/components';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function OtpVerifyScreen() {
  const { phone, verifyOtp, sendOtp, isLoading, error, clearError } = useAuthStore();

  // Step 1 = enter phone, Step 2 = enter OTP
  const [step, setStep] = useState<1 | 2>(phone ? 2 : 1);
  const [phoneInput, setPhoneInput] = useState(phone ?? '');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const trimmed = phoneInput.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your phone number');
      return;
    }
    // Basic format check: allow +233... or 0...
    if (!/^(\+\d{7,15}|0\d{9})$/.test(trimmed)) {
      Alert.alert('Invalid number', 'Enter a valid phone number, e.g. +233241234567 or 0241234567');
      return;
    }
    try {
      await sendOtp(trimmed);
      setCode('');
      setCountdown(30);
      setCanResend(false);
      setStep(2);
    } catch {
      // error handled by store → useEffect above
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleKey = (key: string) => {
    if (key === '⌫') {
      setCode(c => c.slice(0, -1));
    } else if (key !== '' && code.length < 6) {
      setCode(c => c + key);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert('Incomplete', 'Please enter the 6-digit code');
      return;
    }
    await verifyOtp(phone ?? phoneInput.trim(), code);
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      await sendOtp(phone ?? phoneInput.trim());
      setCode('');
      setCountdown(30);
      setCanResend(false);
    } catch {
      // error handled by store
    }
  };

  const maskedPhone = (phone ?? phoneInput).replace(/(\+\d{3})\d{3}(\d{3})(\d{3})/, '$1 XXX $2 $3') || '+233 XXX XXX XXX';

  // ── Step 1 UI ─────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.gy }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <SikasemLogo size="lg" layout="column" showTagline />
          </View>

          <Text style={styles.heading}>Enter your phone</Text>
          <Text style={styles.subtext}>
            We'll send a one-time code to verify your identity.
          </Text>

          <View style={styles.phoneInputWrapper}>
            <TextInput
              style={styles.phoneInput}
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="+233 24 123 4567"
              placeholderTextColor={Colors.t2}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
            />
          </View>

          <Button
            label="Send Code"
            variant="primary"
            loading={isLoading}
            onPress={handleSendOtp}
            style={styles.verifyBtn}
          />

          <Text style={styles.footer}>🔒 ENCRYPTED VERIFICATION</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2 UI ─────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back to step 1 */}
      <Pressable onPress={() => { setStep(1); setCode(''); }} style={styles.backRow}>
        <Text style={styles.backText}>← Change number</Text>
      </Pressable>

      {/* Logo */}
      <View style={styles.logoWrap}>
        <SikasemLogo size="md" layout="row" showTagline={false} />
      </View>

      <Text style={styles.heading}>Check your phone</Text>
      <Text style={styles.subtext}>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
      </Text>

      {/* OTP input */}
      <View style={styles.otpWrapper}>
        <OTPInput value={code} onChange={setCode} length={6} />
      </View>

      {/* Resend row */}
      <View style={styles.resendRow}>
        {canResend ? (
          <Pressable onPress={handleResend}>
            <Text style={styles.resendActive}>Resend code</Text>
          </Pressable>
        ) : (
          <Text style={styles.resendTimer}>
            Didn't receive?{' '}
            <Text style={styles.resendCountdown}>
              Resend ({`0:${countdown.toString().padStart(2, '0')}`})
            </Text>
          </Text>
        )}
      </View>

      {/* Verify button */}
      <Button
        label="Verify & Enable"
        variant="primary"
        loading={isLoading}
        onPress={handleVerify}
        style={styles.verifyBtn}
      />

      {/* Custom keypad */}
      <View style={styles.keypad}>
        {KEYPAD_KEYS.map((key, i) => (
          <Pressable
            key={i}
            style={[styles.keyCell, key === '' && styles.keyCellEmpty]}
            onPress={() => handleKey(key)}
            disabled={key === ''}
          >
            {key !== '' && (
              <Text style={[styles.keyText, key === '⌫' && styles.keyBackspace]}>
                {key}
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>🔒 ENCRYPTED VERIFICATION</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.gy },
  container: {
    flexGrow: 1, alignItems: 'center',
    paddingTop: 60, paddingBottom: 40,
    paddingHorizontal: Spacing.s4,
  },
  backRow: { alignSelf: 'flex-start', marginBottom: Spacing.s4 },
  backText: { ...Typography.bodyMD, color: Colors.g, fontWeight: '700' },
  logoWrap: { marginBottom: Spacing.s5 },
  heading: { ...Typography.titleLG, color: Colors.t, marginBottom: Spacing.s2 },
  subtext: {
    ...Typography.bodyMD, color: Colors.t2,
    textAlign: 'center', lineHeight: 20, marginBottom: Spacing.s5,
  },
  phoneHighlight: { ...Typography.bodyLG, color: Colors.t, fontWeight: '700' },
  phoneInputWrapper: {
    width: '100%', marginBottom: Spacing.s5,
    borderWidth: 1.5, borderColor: Colors.g, borderRadius: Radius.md,
    backgroundColor: Colors.w, ...Shadows.card,
  },
  phoneInput: {
    paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s4,
    ...Typography.bodyLG, color: Colors.t, fontSize: 17,
  },
  otpWrapper: { marginBottom: Spacing.s4, width: '100%', alignItems: 'center' },
  resendRow: { marginBottom: Spacing.s4 },
  resendTimer: { ...Typography.bodyMD, color: Colors.t2 },
  resendCountdown: { color: Colors.t2, fontWeight: '600' },
  resendActive: { ...Typography.bodyMD, color: Colors.g2, fontWeight: '700', textDecorationLine: 'underline' },
  verifyBtn: { width: '100%', marginHorizontal: 0, marginBottom: Spacing.s5 },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: '100%', maxWidth: 320,
    justifyContent: 'center', gap: 0,
  },
  keyCell: {
    width: '33.33%', height: 60,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: Colors.gy2,
    backgroundColor: Colors.w,
  },
  keyCellEmpty: { backgroundColor: Colors.gy },
  keyText: { ...Typography.displayMD, color: Colors.t },
  keyBackspace: { fontSize: 22, color: Colors.t2 },
  footer: {
    ...Typography.bodySM, color: Colors.t2,
    marginTop: Spacing.s5, textAlign: 'center',
  },
});
