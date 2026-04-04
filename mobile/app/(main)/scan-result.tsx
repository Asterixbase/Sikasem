import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Pressable, Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { productsApi, api } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, FormInput, Button, Badge } from '@/components';

export default function ScanResultScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();

  // Form fields
  const [name, setName]           = useState('');
  const [brand, setBrand]         = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice]   = useState('');
  const [stock, setStock]         = useState('1');
  const [categoryId, setCategoryId] = useState('');

  // AI state
  const [suggestion, setSuggestion] = useState<{ name: string; confidence: number } | null>(null);
  const [saving, setSaving]         = useState(false);

  // Label-capture OCR state
  const [showCamera, setShowCamera]   = useState(false);
  const [ocrLoading, setOcrLoading]   = useState(false);
  const [ocrDone, setOcrDone]         = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Auto-suggest category when name changes
  useEffect(() => {
    if (name.length > 2) {
      productsApi.suggestCategory({ name, brand, barcode }).then(r => {
        setSuggestion(r.data.suggestion);
        setCategoryId(r.data.suggestion.category_id);
      }).catch(() => {});
    }
  }, [name]);

  // Auto-open camera for label scan if barcode was just captured
  useEffect(() => {
    if (barcode && !ocrDone) {
      // Small delay so the screen finishes mounting first
      const t = setTimeout(() => setShowCamera(true), 400);
      return () => clearTimeout(t);
    }
  }, [barcode]);

  const handleLabelCapture = async () => {
    if (ocrLoading || !cameraRef.current) return;
    setOcrLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) throw new Error('No image captured');

      const res = await api.post('/ocr/extract', { image_base64: photo.base64 }, {
        params: { hint: 'invoice' },
      });

      // Pre-fill form from OCR result
      const d = res.data;
      if (d.product_name?.value)  setName(d.product_name.value);
      if (d.brand?.value)         setBrand(d.brand.value);
      if (d.sell_price?.value)    setSellPrice(String(d.sell_price.value / 100));
      if (d.buy_price?.value)     setBuyPrice(String(d.buy_price.value / 100));
      if (d.quantity?.value)      setStock(String(d.quantity.value));

      setOcrDone(true);
      setShowCamera(false);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Could not read label';
      Alert.alert('OCR Failed', msg);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !sellPrice || !buyPrice || !categoryId) {
      Alert.alert('Incomplete', 'Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      await productsApi.create({
        name, barcode, category_id: categoryId,
        sell_price_pesawas: Math.round(parseFloat(sellPrice) * 100),
        buy_price_pesawas:  Math.round(parseFloat(buyPrice)  * 100),
        initial_stock: parseInt(stock, 10),
      });
      router.replace('/(main)/dash');
    } catch {
      Alert.alert('Error', 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  // ── Camera modal for label OCR ────────────────────────────────────────────
  const renderCameraModal = () => (
    <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
      <View style={styles.cameraRoot}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill}>
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraTopBar}>
                <Pressable onPress={() => setShowCamera(false)} style={styles.cameraClose} hitSlop={8}>
                  <Text style={styles.cameraCloseText}>✕</Text>
                </Pressable>
                <View style={styles.cameraPill}>
                  <Text style={styles.cameraPillText}>POINT AT PRODUCT LABEL</Text>
                </View>
              </View>

              {/* Label frame guide */}
              <View style={styles.labelFrame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>

              <Text style={styles.cameraHint}>Align the label within the frame</Text>

              <Pressable
                onPress={handleLabelCapture}
                style={styles.captureBtn}
                disabled={ocrLoading}
              >
                {ocrLoading
                  ? <ActivityIndicator color={Colors.w} size="large" />
                  : <View style={styles.captureInner} />}
              </Pressable>
            </View>
          </CameraView>
        ) : (
          <View style={styles.permCenter}>
            <Text style={styles.permMsg}>Camera permission required</Text>
            <Pressable onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      {renderCameraModal()}
      <ScreenHeader title="New Product" subtitle={barcode || 'Manual Entry'} />
      <ScrollView contentContainerStyle={{ padding: Spacing.s4 }}>

        {/* Barcode + Label correlation banner */}
        <View style={styles.ocrBanner}>
          <View style={styles.ocrBannerLeft}>
            <Text style={styles.ocrBannerIcon}>{ocrDone ? '✓' : '📷'}</Text>
            <View>
              <Text style={styles.ocrBannerTitle}>
                {ocrDone ? 'Label scanned — fields pre-filled' : 'Scan product label'}
              </Text>
              <Text style={styles.ocrBannerSub}>
                {barcode ? `Barcode: ${barcode}` : 'No barcode — manual entry'}
              </Text>
            </View>
          </View>
          {!ocrDone && (
            <Pressable style={styles.ocrBtn} onPress={() => setShowCamera(true)}>
              <Text style={styles.ocrBtnText}>Scan Label</Text>
            </Pressable>
          )}
        </View>

        {/* AI category suggestion */}
        {suggestion && (
          <View style={styles.aiBanner}>
            <Text style={styles.aiText}>AI Category: {suggestion.name}</Text>
            <Badge label={`${suggestion.confidence}%`} variant="green" />
          </View>
        )}

        <FormInput label="Product Name *" value={name} onChangeText={setName} placeholder="e.g. Indomie 70g Chicken" />
        <FormInput label="Brand (optional)" value={brand} onChangeText={setBrand} />
        <FormInput label="Sell Price (GHS) *" value={sellPrice} onChangeText={setSellPrice} keyboardType="decimal-pad" />
        <FormInput label="Buy Price (GHS) *" value={buyPrice} onChangeText={setBuyPrice} keyboardType="decimal-pad" />
        <FormInput label="Initial Stock" value={stock} onChangeText={setStock} keyboardType="number-pad" />
        <Button
          label={categoryId ? 'Change Category' : 'Select Category *'}
          variant="secondary"
          onPress={() => router.push({ pathname: '/(main)/cat', params: { categoryId } })}
        />
        <Button label="Save Product" onPress={handleSave} loading={saving} />
        <Button label="Discard" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const C = Colors.scanPrimary;
const styles = StyleSheet.create({
  // OCR correlation banner
  ocrBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.w, borderRadius: Radius.md, padding: Spacing.s3,
    marginBottom: Spacing.s3, borderWidth: 1, borderColor: Colors.gy2,
  },
  ocrBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2, flex: 1 },
  ocrBannerIcon: { fontSize: 22 },
  ocrBannerTitle: { ...Typography.titleSM, color: Colors.t },
  ocrBannerSub: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  ocrBtn: {
    backgroundColor: Colors.g, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.s3, paddingVertical: 7, minHeight: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  ocrBtnText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },

  // AI banner
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gx, borderRadius: Radius.md,
    padding: Spacing.s3, marginBottom: Spacing.s3,
  },
  aiText: { ...Typography.bodyMD, color: Colors.g, flex: 1, marginRight: 8 },

  // Camera modal
  cameraRoot: { flex: 1, backgroundColor: '#0a0a0a' },
  cameraOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  cameraTopBar: {
    position: 'absolute', top: 52, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cameraClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraCloseText: { color: Colors.w, fontSize: 16, fontWeight: '700' },
  cameraPill: {
    backgroundColor: Colors.g, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  cameraPillText: { ...Typography.badge, color: Colors.w },
  // Label frame corners
  labelFrame: { width: 260, height: 160, position: 'relative', marginBottom: 24 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: C, borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  cameraHint: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: 32,
  },
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
  permCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gy },
  permMsg: { ...Typography.bodyLG, color: Colors.t, marginBottom: Spacing.s4 },
  permBtn: { backgroundColor: Colors.g, borderRadius: Radius.sm, paddingHorizontal: Spacing.s5, paddingVertical: Spacing.s3 },
  permBtnText: { ...Typography.titleSM, color: Colors.w },
});
