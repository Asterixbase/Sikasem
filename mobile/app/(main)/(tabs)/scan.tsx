import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { productsApi } from '@/api';
import { Colors, Typography } from '@/constants';
import { useTheme } from '@/hooks/useTheme';

const MODES = [
  { key: 'barcode', label: 'BARCODE' },
  { key: 'ocr',     label: 'LABEL OCR' },
  { key: 'bulk',    label: 'BULK COUNT' },
] as const;

type ModeKey = typeof MODES[number]['key'];

export default function ScanScreen() {
  const C = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeKey>('barcode');

  useEffect(() => { if (!permission?.granted) requestPermission(); }, []);

  const handleModePress = (key: ModeKey) => {
    if (key === 'barcode') { setActiveMode('barcode'); return; }
    const params = { mode: key };
    router.push({ pathname: '/(main)/bulk' as any, params });
  };

  const handleBarcode = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      await productsApi.getByBarcode(data);
      // Product exists in our inventory — go to SKU detail
      router.push({ pathname: '/(main)/skus', params: { barcode: data } });
    } catch (e: any) {
      // 404 = new product, or any other error (network, 500) = treat as new product
      // scan-result will do its own lookup and handle both cases
      router.push({ pathname: '/(main)/scan-result', params: { barcode: data } });
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera permission required</Text>
        <Pressable onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <CameraView style={{ flex: 1 }} onBarcodeScanned={scanned ? undefined : handleBarcode} barcodeScannerSettings={{ barcodeTypes: ['ean13','ean8','upc_a','qr','code128','code39'] }}>
        <View style={styles.overlay}>
          <View style={styles.frame}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.tl, { borderColor: C.scanPrimary }]} />
            <View style={[styles.corner, styles.tr, { borderColor: C.scanPrimary }]} />
            <View style={[styles.corner, styles.bl, { borderColor: C.scanPrimary }]} />
            <View style={[styles.corner, styles.br, { borderColor: C.scanPrimary }]} />
          </View>
          <View style={[styles.pill, { backgroundColor: C.scanPrimary }]}>
            <View style={styles.dot} />
            <Text style={styles.pillText}>ALIGN BARCODE INSIDE FRAME</Text>
          </View>
          {/* Manual entry shortcut */}
          <Pressable style={styles.manualBtn} onPress={() => router.push('/(main)/scan-result' as any)}>
            <Text style={styles.manualText}>＋ Add Item Manually</Text>
          </Pressable>
        </View>
      </CameraView>

      {/* Mode strip */}
      <View style={styles.modeStrip}>
        {MODES.map(m => (
          <Pressable
            key={m.key}
            style={[styles.modeTab, activeMode === m.key && { backgroundColor: C.scanPrimary, borderColor: C.scanPrimary }]}
            onPress={() => handleModePress(m.key)}
          >
            <Text style={[styles.modeTabText, activeMode === m.key && styles.modeTabTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {scanned && (
        <Pressable style={styles.rescanBtn} onPress={() => setScanned(false)}>
          <Text style={styles.rescanText}>Tap to scan again</Text>
        </Pressable>
      )}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={{ color: Colors.w, fontSize: 16, fontWeight: '700' }}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gy },
  msg: { ...Typography.bodyLG, color: Colors.t },
  btn: { marginTop: 16, backgroundColor: Colors.scanPrimary, borderRadius: 8, padding: 12 },
  btnText: { color: Colors.w, fontWeight: '700' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 160, position: 'relative' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: Colors.scanPrimary, borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  pill: {
    marginTop: 24, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.scanPrimary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.w },
  pillText: { ...Typography.badge, color: Colors.w },
  manualBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  manualText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  // Mode strip
  modeStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  modeTab: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  modeTabActive: {
    backgroundColor: Colors.scanPrimary,
    borderColor: Colors.scanPrimary,
  },
  modeTabText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.55)',
  },
  modeTabTextActive: {
    color: Colors.w,
  },
  rescanBtn: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
  },
  rescanText: { color: Colors.w, fontWeight: '600' },
  backBtn: {
    position: 'absolute', top: 52, left: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
});
