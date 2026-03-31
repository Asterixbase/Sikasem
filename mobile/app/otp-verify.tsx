import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView,
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import { OTPInput, Button } from '@/components';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function OtpVerifyScreen() {
  const { phone, verifyOtp, isLoading, error, clearError, sendOtp } = useAuthStore();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (error) {
      Alert.alert('Verification Failed', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setCode(c => c.slice(0, -1));
    } else if (key === '') {
      // no-op (empty cell)
    } else if (code.length < 6) {
      setCode(c => c + key);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert('Incomplete', 'Please enter the 6-digit code');
      return;
    }
    await verifyOtp(phone ?? '', code);
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      await sendOtp(phone ?? '');
      setCode('');
      setCountdown(30);
      setCanResend(false);
    } catch {
      // error handled by store
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})\d{3}(\d{3})(\d{3})/, '$1 XXX $2 $3')
    : '+233 XXX XXX XXX';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Shield icon */}
      <View style={styles.shieldCircle}>
        <Text style={styles.shieldIcon}>🛡</Text>
      </View>

      {/* Labels */}
      <Text style={styles.secureLabel}>SECURE ACCESS</Text>
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
  shieldCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.gl,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s4,
    borderWidth: 3, borderColor: Colors.g,
  },
  shieldIcon: { fontSize: 36 },
  secureLabel: {
    ...Typography.label, color: Colors.g2, marginBottom: Spacing.s2,
  },
  heading: { ...Typography.titleLG, color: Colors.t, marginBottom: Spacing.s2 },
  subtext: {
    ...Typography.bodyMD, color: Colors.t2,
    textAlign: 'center', lineHeight: 20, marginBottom: Spacing.s5,
  },
  phoneHighlight: { ...Typography.bodyLG, color: Colors.t, fontWeight: '700' },
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
