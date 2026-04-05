import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Pressable } from 'react-native';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, FormInput, Button, Badge } from '@/components';
import { useOcrLabelStore } from '@/store/ocrLabel';

export default function ScanResultScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();

  // Form fields
  const [name, setName]             = useState('');
  const [brand, setBrand]           = useState('');
  const [sellPrice, setSellPrice]   = useState('');
  const [buyPrice, setBuyPrice]     = useState('');
  const [stock, setStock]           = useState('1');
  const [categoryId, setCategoryId] = useState('');

  const [suggestion, setSuggestion]     = useState<{ name: string; confidence: number } | null>(null);
  const [saving, setSaving]             = useState(false);
  const [ocrDone, setOcrDone]           = useState(false);
  const [ocrAttempted, setOcrAttempted] = useState(false);
  const [existingProductId, setExistingProductId] = useState<string | null>(null);

  // On mount: if we have a barcode, check if the product already exists in the DB.
  // If it does → pre-fill all fields immediately (no OCR needed).
  // If not    → auto-launch label camera to OCR the label.
  useEffect(() => {
    if (!barcode) return;
    productsApi.getByBarcode(barcode)
      .then(r => {
        const p = r.data as any;
        setName(p.name ?? '');
        setBrand('');   // not stored on Product model separately
        setSellPrice(p.sell_price_pesawas ? String((p.sell_price_pesawas / 100).toFixed(2)) : '');
        setBuyPrice(p.buy_price_pesawas   ? String((p.buy_price_pesawas  / 100).toFixed(2)) : '');
        setCategoryId(p.category_id ?? '');
        setExistingProductId(p.product_id ?? p.id ?? null);
        setOcrDone(true);   // fields are pre-filled — skip OCR launch
      })
      .catch(() => {
        // Product not in DB — launch camera for OCR
        const t = setTimeout(() => router.push('/(main)/camera-label'), 400);
        return () => clearTimeout(t);
      });
  }, [barcode]);

  // When camera-label screen returns, populate fields from the OCR store snapshot.
  // Read directly from Zustand getState() — no dependency on React render cycle,
  // which avoids the race where router.back() fires before scan-result re-renders.
  useFocusEffect(
    React.useCallback(() => {
      const snap = useOcrLabelStore.getState();
      const ocr  = snap.result;
      if (!ocr) return;

      let filled = 0;
      if (ocr.product_name?.value) { setName(String(ocr.product_name.value));   filled++; }
      if (ocr.brand?.value)        { setBrand(String(ocr.brand.value));          filled++; }
      if (ocr.sell_price?.value)   {
        setSellPrice(String((Number(ocr.sell_price.value) / 100).toFixed(2)));   filled++;
      }
      if (ocr.buy_price?.value)    {
        setBuyPrice(String((Number(ocr.buy_price.value) / 100).toFixed(2)));     filled++;
      }
      if (ocr.quantity?.value)     { setStock(String(ocr.quantity.value));       filled++; }
      if (ocr.barcode?.value && !barcode) {
        // If the OCR picked up a barcode and we don't already have one, use it
        // (scan-result doesn't have a setter for barcode param, but we can pre-fill name at minimum)
      }

      setOcrAttempted(true);
      setOcrDone(filled > 0);   // only mark "done" if at least one field was extracted
      snap.clear();
    }, [barcode])  // barcode is stable, used for the barcode fallback check above
  );

  // Auto-suggest category when name changes
  useEffect(() => {
    if (name.length > 2) {
      productsApi.suggestCategory({ name, brand, barcode }).then(r => {
        setSuggestion(r.data.suggestion);
        setCategoryId(r.data.suggestion.category_id);
      }).catch(() => {});
    }
  }, [name]);

  // (camera auto-launch is now handled inside the barcode lookup effect above)

  const handleSave = async () => {
    if (!name || !sellPrice || !buyPrice || !categoryId) {
      Alert.alert('Incomplete', 'Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      await productsApi.create({
        name, barcode, category_id: categoryId,
        sell_price_pesawas: Math.round(parseFloat(sellPrice) * 100),
        buy_price_pesawas:  Math.round(parseFloat(buyPrice)  * 100),
        initial_stock: parseInt(stock, 10),
      });
      router.replace('/(main)/(tabs)/dash');
    } catch {
      Alert.alert('Error', 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="New Product" subtitle={barcode || 'Manual Entry'} />
      <ScrollView contentContainerStyle={{ padding: Spacing.s4 }}>

        {/* Barcode + OCR banner */}
        <View style={[styles.ocrBanner, ocrAttempted && !ocrDone && styles.ocrBannerWarn, existingProductId && styles.ocrBannerSuccess]}>
          <View style={styles.ocrBannerLeft}>
            <Text style={styles.ocrBannerIcon}>
              {existingProductId ? '📦' : ocrDone ? '✓' : ocrAttempted ? '⚠️' : '📷'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.ocrBannerTitle}>
                {existingProductId
                  ? 'Product found — update details'
                  : ocrDone
                  ? 'Label scanned — fields pre-filled'
                  : ocrAttempted
                  ? 'Label scanned — fill in manually'
                  : 'Scan product label'}
              </Text>
              <Text style={styles.ocrBannerSub}>
                {existingProductId
                  ? `Barcode ${barcode} is already in your inventory`
                  : ocrAttempted && !ocrDone
                  ? 'Could not read label — try a clearer photo'
                  : barcode ? `Barcode: ${barcode}` : 'No barcode — manual entry'}
              </Text>
            </View>
          </View>
          {!ocrDone && !existingProductId && (
            <Pressable
              style={[styles.ocrBtn, ocrAttempted && styles.ocrBtnRescan]}
              onPress={() => { setOcrAttempted(false); router.push('/(main)/camera-label'); }}
            >
              <Text style={styles.ocrBtnText}>{ocrAttempted ? 'Retry' : 'Scan Label'}</Text>
            </Pressable>
          )}
        </View>

        {/* AI category suggestion */}
        {suggestion && (
          <View style={styles.aiBanner}>
            <Text style={styles.aiText}>AI Category: {suggestion.name}</Text>
            <Badge label={`${Math.round(suggestion.confidence * 100)}%`} variant="green" />
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
        <Button label={existingProductId ? 'Update Product' : 'Save Product'} onPress={handleSave} loading={saving} />
        <Button label="Discard" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ocrBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.w, borderRadius: Radius.md, padding: Spacing.s3,
    marginBottom: Spacing.s3, borderWidth: 1, borderColor: Colors.gy2,
  },
  ocrBannerWarn:    { borderColor: Colors.at, backgroundColor: '#FFFBEB' },
  ocrBannerSuccess: { borderColor: Colors.g,  backgroundColor: '#F0FDF4' },
  ocrBtnRescan: { backgroundColor: Colors.at },
  ocrBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2, flex: 1 },
  ocrBannerIcon: { fontSize: 22 },
  ocrBannerTitle: { ...Typography.titleSM, color: Colors.t },
  ocrBannerSub: { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  ocrBtn: {
    backgroundColor: Colors.g, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.s3, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  ocrBtnText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gx, borderRadius: Radius.md,
    padding: Spacing.s3, marginBottom: Spacing.s3,
  },
  aiText: { ...Typography.bodyMD, color: Colors.g, flex: 1, marginRight: 8 },
});
