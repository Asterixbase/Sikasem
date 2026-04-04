import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';

type Mode = 'SCAN MODE' | 'LABEL OCR' | 'BULK COUNT';

export default function BulkScreen() {
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeMode, setActiveMode] = useState<Mode>(
    initialMode === 'ocr' ? 'LABEL OCR' : 'BULK COUNT'
  );
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      // 1. Take the photo
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) throw new Error('No image captured');

      // 2. POST image + mode to OCR endpoint
      const ocrMode = activeMode === 'LABEL OCR' ? 'invoice' : 'bulk_scan';
      const res = await api.post('/ocr/extract', { image_base64: photo.base64 }, {
        params: { hint: ocrMode },
      });

      if (activeMode === 'LABEL OCR') {
        // Route to inv-ext (invoice/label extraction result)
        router.push({
          pathname: '/(main)/inv-ext',
          params: { data: JSON.stringify(res.data) },
        });
      } else {
        // Route to bulk-result (item count result)
        router.push({
          pathname: '/(main)/bulk-result',
          params: { data: JSON.stringify(res.data) },
        });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Could not process image';
      Alert.alert('Capture Failed', msg);
      setCapturing(false);
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

  const MODES: Mode[] = ['SCAN MODE', 'LABEL OCR', 'BULK COUNT'];

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill}>
        {/* 4x4 grid overlay */}
        <View style={styles.gridOverlay} pointerEvents="none">
          {[1, 2, 3].map(i => (
            <View key={`h${i}`} style={[styles.gridLineH, { top: `${i * 25}%` as any }]} />
          ))}
          {[1, 2, 3].map(i => (
            <View key={`v${i}`} style={[styles.gridLineV, { left: `${i * 25}%` as any }]} />
          ))}
        </View>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/(main)/scan')} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.orientPill}>
            <View style={styles.orientDot} />
            <Text style={styles.orientText}>TOP-DOWN</Text>
          </View>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {activeMode === 'LABEL OCR' ? 'Label OCR Active' : 'Bulk Detection Active'}
            </Text>
          </View>
        </View>

        {/* Mode instruction */}
        <View style={styles.hintWrap} pointerEvents="none">
          <Text style={styles.hintText}>
            {activeMode === 'LABEL OCR'
              ? 'Point at a product label or invoice'
              : 'Point down at a tray of products'}
          </Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <View style={styles.modeRow}>
            {MODES.map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setActiveMode(mode)}
                style={[styles.modeBtn, activeMode === mode && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, activeMode === mode && styles.modeBtnTextActive]}>
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleCapture} style={styles.captureBtn} disabled={capturing}>
            {capturing
              ? <ActivityIndicator color={Colors.w} size="large" />
              : <View style={styles.captureInner} />}
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gy,
  },
  permMsg: { ...Typography.bodyLG, color: Colors.t, marginBottom: Spacing.s4 },
  permBtn: {
    backgroundColor: Colors.g, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.s5, paddingVertical: Spacing.s3,
  },
  permBtnText: { ...Typography.titleSM, color: Colors.w },

  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLineH: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gridLineV: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: Spacing.s4,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.s2,
  },
  backIcon: { fontSize: 24, color: Colors.w, lineHeight: 28, marginTop: -2 },
  orientPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  orientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.w },
  orientText: { ...Typography.label, color: Colors.w },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.scanPrimary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    marginLeft: 'auto',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.w },
  statusText: { ...Typography.badge, color: Colors.w },

  hintWrap: {
    position: 'absolute', top: '40%', left: 0, right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6,
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 40, paddingHorizontal: Spacing.s4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', gap: Spacing.s5,
    paddingTop: Spacing.s4,
  },
  modeRow: { flexDirection: 'row', gap: Spacing.s2 },
  modeBtn: {
    paddingHorizontal: Spacing.s3, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  modeBtnActive: { backgroundColor: Colors.scanPrimary, borderColor: Colors.scanPrimary },
  modeBtnText: { ...Typography.badge, color: 'rgba(255,255,255,0.7)' },
  modeBtnTextActive: { color: Colors.w },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: Colors.w,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.w,
  },
});
