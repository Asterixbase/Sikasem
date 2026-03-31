import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { router } from 'expo-router';
import { taxApi } from '@/api';
import { Colors, Typography } from '@/constants';

type ScanTab = 'SINGLE' | 'BATCH' | 'AUTO';

export default function InvScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<ScanTab>('SINGLE');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      const base64 = photo?.base64 ?? '';
      const res = await taxApi.ocrExtractInvoice({ image_base64: base64, period: '2026-03' });
      router.push({ pathname: '/(main)/inv-ext', params: { data: JSON.stringify(res.data) } });
    } catch {
      Alert.alert('OCR Error', 'Could not extract invoice. Please try again.');
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

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.statusPill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>OCR ARCHIVIST ACTIVE</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Center overlay */}
        <View style={styles.centerOverlay}>
          {/* Corner brackets */}
          <View style={styles.bracketFrame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Text style={styles.centerText}>Point at invoice</Text>
          </View>

          {/* Automation badges */}
          <View style={styles.badgesRow}>
            {['AUTO-CROP', 'DESKEW', 'CONTRAST-BOOST'].map(b => (
              <View key={b} style={styles.autoBadge}>
                <Text style={styles.autoBadgeText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomPanel}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['SINGLE', 'BATCH', 'AUTO'] as ScanTab[]).map(tab => (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Capture button */}
          <Pressable style={styles.captureBtn} onPress={handleCapture} disabled={capturing}>
            {capturing
              ? <ActivityIndicator color={Colors.g} size="large" />
              : <View style={styles.captureInner} />
            }
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gy },
  permMsg: { ...Typography.bodyLG, color: Colors.t, marginBottom: 16 },
  permBtn: { backgroundColor: Colors.g, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
  permBtnText: { color: Colors.w, fontWeight: '700' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: Colors.w, lineHeight: 26, marginTop: -1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.g, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.w },
  pillText: { ...Typography.badge, color: Colors.w, letterSpacing: 0.5 },

  centerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bracketFrame: { width: 260, height: 180, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.g, borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  centerText: { ...Typography.bodyLG, color: Colors.w, textAlign: 'center' },

  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  autoBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  autoBadgeText: { ...Typography.badge, color: Colors.w },

  bottomPanel: {
    paddingBottom: 40, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center',
  },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  tab: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tabActive: { backgroundColor: Colors.g, borderColor: Colors.g },
  tabText: { ...Typography.badge, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: Colors.w },

  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.w, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
  },
  captureInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.w,
    borderWidth: 2, borderColor: Colors.gy2,
  },
});
