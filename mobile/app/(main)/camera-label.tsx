/**
 * Full-screen product-label camera screen.
 * Navigated to via router.push('/(main)/camera-label').
 * On successful capture, stores OCR result in useOcrLabelStore then router.back().
 * iOS swipe-back and Android hardware-back both work naturally.
 */
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { api } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { useOcrLabelStore } from '@/store/ocrLabel';

export default function CameraLabelScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const setResult = useOcrLabelStore(s => s.setResult);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  const handleCapture = async () => {
    if (loading || !cameraRef.current) return;
    setLoading(true);
    setError('');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (!photo?.base64) throw new Error('Camera did not return an image');

      const res = await api.post('/ocr/extract', { image_base64: photo.base64 }, {
        params: { hint: 'product_label' },
        timeout: 90_000,  // 90s — Claude vision + network can take 30-60s
      });

      setResult(res.data);
      router.back();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Could not read label';
      setError(msg);
      setLoading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permMsg}>Camera permission required</Text>
        <Pressable onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const C = Colors.scanPrimary;

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          <View style={styles.pill}>
            <Text style={styles.pillText}>POINT AT PRICE TAG / LABEL TEXT</Text>
          </View>
        </View>

        {/* Label frame corners */}
        <View style={styles.frameWrap}>
          <View style={styles.labelFrame}>
            {[['tl', 0, 0], ['tr', 0, null], ['bl', null, 0], ['br', null, null]].map(([key, top, left]) => (
              <View
                key={key as string}
                style={[
                  styles.corner,
                  top === 0 ? { top: 0 } : { bottom: 0 },
                  left === 0 ? { left: 0, borderRightWidth: 0, borderBottomWidth: 0 } : { right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
                  key === 'bl' && { borderRightWidth: 0, borderTopWidth: 0, borderBottomWidth: 3 },
                  key === 'br' && { borderLeftWidth: 0, borderTopWidth: 0, borderBottomWidth: 3 },
                ]}
              />
            ))}
          </View>
          <Text style={styles.hint}>Focus on price & product text — not the barcode</Text>
        </View>

        {/* Error message */}
        {!!error && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorRetry} onPress={() => setError('')}>Tap to retry</Text>
          </View>
        )}

        {/* Capture button */}
        <View style={styles.bottomBar}>
          <Pressable onPress={handleCapture} style={styles.captureBtn} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.w} size="large" />
              : <View style={styles.captureInner} />}
          </Pressable>
          {loading && <Text style={styles.loadingText}>Reading label — this may take up to 30 seconds…</Text>}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gy },
  permMsg: { ...Typography.bodyLG, color: Colors.t, marginBottom: Spacing.s4 },
  permBtn: { backgroundColor: Colors.g, borderRadius: Radius.sm, paddingHorizontal: Spacing.s5, paddingVertical: Spacing.s3 },
  permBtnText: { ...Typography.titleSM, color: Colors.w },

  topBar: {
    position: 'absolute', top: 56, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 10,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backIcon: { fontSize: 18, color: Colors.w, lineHeight: 22 },
  backLabel: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  pill: {
    flex: 1, backgroundColor: Colors.g, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center',
  },
  pillText: { ...Typography.badge, color: Colors.w },

  frameWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  labelFrame: { width: 300, height: 220, position: 'relative', marginBottom: 16 },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: Colors.scanPrimary, borderWidth: 3,
  },

  hint: {
    color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6,
  },

  errorWrap: {
    marginHorizontal: 24, backgroundColor: 'rgba(220,38,38,0.85)',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  errorText: { ...Typography.bodyMD, color: Colors.w, textAlign: 'center' },
  errorRetry: { ...Typography.bodySM, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, alignItems: 'center', gap: 12,
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: Colors.w,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.w },
  loadingText: { ...Typography.badge, color: Colors.w },
});
