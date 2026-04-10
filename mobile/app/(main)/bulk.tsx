import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Keyboard, InteractionManager,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { useThemePalette } from '@/store/theme';

type Mode = 'SCAN MODE' | 'LABEL OCR' | 'BULK COUNT';

export default function BulkScreen() {
  const theme = useThemePalette();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeMode, setActiveMode] = useState<Mode>(
    initialMode === 'ocr' ? 'LABEL OCR' : 'BULK COUNT'
  );
  const [capturing, setCapturing] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  // Parse "Coca-Cola, 24" or "24 Coca-Cola" into name + qty
  const parseVoiceText = (text: string): { name: string; qty: number | null } => {
    const t = text.trim();
    // "name, number" or "name number" at end
    const m1 = t.match(/^(.+?)[,\s]+(\d+)\s*$/);
    if (m1) return { name: m1[1].trim(), qty: parseInt(m1[2], 10) };
    // "number name" at start
    const m2 = t.match(/^(\d+)\s+(.+)$/);
    if (m2) return { name: m2[2].trim(), qty: parseInt(m2[1], 10) };
    return { name: t, qty: null };
  };

  const handleVoiceConfirm = () => {
    const { name, qty } = parseVoiceText(voiceText);
    if (!name) return;
    const navData = JSON.stringify({
      detected_qty: qty ?? 0,
      strategy_label: 'Voice Count',
      product_name: name,
      confidence_scores: { product_name: 90, quantity: qty != null ? 95 : 0, unit_price: 0 },
    });
    // Dismiss keyboard first, then close modal, then wait for ALL animations to finish
    // before navigating — avoids CameraView native crash during modal slide-out
    Keyboard.dismiss();
    setShowVoiceModal(false);
    setVoiceText('');
    InteractionManager.runAfterInteractions(() => {
      router.replace({ pathname: '/(main)/bulk-result', params: { data: navData } });
    });
  };

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) throw new Error('No image captured');

      const ocrMode = activeMode === 'LABEL OCR' ? 'invoice' : 'bulk_scan';
      const res = await api.post('/ocr/extract', { image_base64: photo.base64 }, {
        params: { hint: ocrMode },
      });

      if (activeMode === 'LABEL OCR') {
        router.push({ pathname: '/(main)/inv-ext', params: { data: JSON.stringify(res.data) } });
      } else {
        const raw = res.data;
        const normalised = {
          detected_qty: raw.quantity ?? 0,
          strategy_label: raw.strategy_label ?? 'AI Estimate',
          confidence_scores: {
            product_name: Math.round((raw.confidence ?? 0) * 100),
            quantity: Math.round((raw.confidence ?? 0) * 100),
            unit_price: Math.round((raw.confidence ?? 0) * 80),
          },
        };
        router.push({ pathname: '/(main)/bulk-result', params: { data: JSON.stringify(normalised) } });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Could not process image';
      setCapturing(false);
      // show inline error
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permMsg}>Camera permission required</Text>
        <Pressable onPress={requestPermission} style={[styles.permBtn, { backgroundColor: theme.primary }]}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const MODES: Mode[] = ['SCAN MODE', 'LABEL OCR', 'BULK COUNT'];
  const { name: parsedName, qty: parsedQty } = voiceText.trim() ? parseVoiceText(voiceText) : { name: '', qty: null };

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill}>
        {/* 4×4 grid overlay */}
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
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>

          <View style={styles.orientPill}>
            <View style={styles.orientDot} />
            <Text style={styles.orientText}>TOP-DOWN</Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: theme.scanPrimary }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {activeMode === 'LABEL OCR' ? 'Label OCR Active' : 'Bulk Detection Active'}
            </Text>
          </View>
        </View>

        {/* Mode hint */}
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
                style={[styles.modeBtn, activeMode === mode && { backgroundColor: theme.scanPrimary, borderColor: theme.scanPrimary }]}
              >
                <Text style={[styles.modeBtnText, activeMode === mode && styles.modeBtnTextActive]}>
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.captureRow}>
            <Pressable onPress={handleCapture} style={styles.captureBtn} disabled={capturing}>
              {capturing
                ? <ActivityIndicator color={Colors.w} size="large" />
                : <View style={styles.captureInner} />}
            </Pressable>

            {/* Voice mic — tap to open dictation modal */}
            {activeMode === 'BULK COUNT' && (
              <Pressable
                onPress={() => { setVoiceText(''); setShowVoiceModal(true); }}
                style={styles.micBtn}
              >
                <Text style={styles.micIcon}>🎙️</Text>
              </Pressable>
            )}
          </View>
        </View>
      </CameraView>

      {/* Voice count modal — uses iOS keyboard dictation or manual typing */}
      <Modal
        transparent
        animationType="slide"
        visible={showVoiceModal}
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎙️ Voice Stock Count</Text>
            <Text style={styles.modalHint}>
              Tap the 🎤 on your keyboard and say the product and quantity,{'\n'}
              or type below — e.g. <Text style={{ fontWeight: '700' }}>Coca-Cola, 24</Text>
            </Text>

            <TextInput
              style={[styles.modalInput, voiceText.trim() && { borderColor: theme.primary }]}
              placeholder="e.g. Coca-Cola, 24"
              placeholderTextColor={Colors.t3}
              value={voiceText}
              onChangeText={setVoiceText}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleVoiceConfirm}
            />

            {/* Live parse preview */}
            {parsedName ? (
              <View style={styles.parsePreview}>
                <View style={styles.parseField}>
                  <Text style={styles.parseLabel}>PRODUCT</Text>
                  <Text style={styles.parseValue}>{parsedName}</Text>
                </View>
                <View style={styles.parseField}>
                  <Text style={styles.parseLabel}>QTY</Text>
                  <Text style={styles.parseValue}>{parsedQty ?? '—'}</Text>
                </View>
              </View>
            ) : null}

            <Pressable
              style={[styles.modalConfirmBtn, { backgroundColor: parsedName ? theme.primary : Colors.gy2 }]}
              onPress={handleVoiceConfirm}
              disabled={!parsedName}
            >
              <Text style={[styles.modalConfirmText, !parsedName && { color: Colors.t3 }]}>
                Confirm →
              </Text>
            </Pressable>

            <Pressable onPress={() => setShowVoiceModal(false)} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    borderRadius: Radius.sm,
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
    paddingTop: 56, paddingHorizontal: Spacing.s4,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    zIndex: 20,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  backIcon: { fontSize: 18, color: Colors.w, lineHeight: 22 },
  backLabel: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  orientPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  orientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.w },
  orientText: { ...Typography.label, color: Colors.w },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full,
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
  modeBtnText: { ...Typography.badge, color: 'rgba(255,255,255,0.7)' },
  modeBtnTextActive: { color: Colors.w },
  captureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s5 },
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
  micBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  micIcon: { fontSize: 24 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.w, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.s5, gap: Spacing.s3,
  },
  modalTitle: { ...Typography.titleMD, color: Colors.t },
  modalHint: { ...Typography.bodySM, color: Colors.t2, lineHeight: 18 },
  modalInput: {
    borderWidth: 1.5, borderColor: Colors.gy2, borderRadius: Radius.md,
    paddingHorizontal: Spacing.s3, paddingVertical: 12,
    ...Typography.bodyLG, color: Colors.t,
  },
  parsePreview: {
    flexDirection: 'row', gap: Spacing.s4,
    backgroundColor: Colors.gy, borderRadius: Radius.md, padding: Spacing.s3,
  },
  parseField: { flex: 1 },
  parseLabel: { ...Typography.label, color: Colors.t2 },
  parseValue: { ...Typography.titleSM, color: Colors.t, marginTop: 2 },
  modalConfirmBtn: {
    borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center',
  },
  modalConfirmText: { ...Typography.titleSM, color: Colors.w },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { ...Typography.bodyMD, color: Colors.t2 },
});
