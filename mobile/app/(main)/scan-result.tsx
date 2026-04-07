import React, { useState, useEffect, useRef } from 'react';
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

  // Category suggestion debounce timer
  const catDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Barcode lookup on mount ──────────────────────────────────────────────
  // Known product → pre-fill from DB (no OCR needed).
  // Unknown product → auto-launch camera-label, but only ONCE per barcode.
  // The "launchedForBarcode" key lives in Zustand so it survives component
  // remounts that happen when returning from camera-label.
  useEffect(() => {
    if (!barcode) return; // manual entry — user fills in themselves

    productsApi.getByBarcode(barcode)
      .then(r => {
        const p = r.data as any;
        setName(p.name ?? '');
        setBrand('');
        setSellPrice(p.sell_price_pesawas ? String((p.sell_price_pesawas / 100).toFixed(2)) : '');
        setBuyPrice(p.buy_price_pesawas   ? String((p.buy_price_pesawas  / 100).toFixed(2)) : '');
        setCategoryId(p.category_id ?? '');
        setExistingProductId(p.product_id ?? p.id ?? null);
        setOcrDone(true);
      })
      .catch(() => {
        // Product not in DB. Auto-launch camera once per barcode.
        const store = useOcrLabelStore.getState();

        // Guard 1: camera already launched for this barcode (survives remount)
        if (store.launchedForBarcode === barcode) return;

        // Guard 2: OCR result is already waiting in the store (camera already done)
        if (store.result) return;

        // Mark launched BEFORE navigating so any remount triggered by navigation
        // sees the flag immediately.
        store.setLaunchedForBarcode(barcode);
        const t = setTimeout(() => router.push('/(main)/camera-label'), 300);
        return () => clearTimeout(t);
      });
  }, [barcode]);

  // ── OCR result reader ────────────────────────────────────────────────────
  // Fires when the screen gains focus after returning from camera-label.
  // Reads directly from Zustand getState() — no stale closure risk.
  useFocusEffect(
    React.useCallback(() => {
      const snap = useOcrLabelStore.getState();
      const ocr  = snap.result;
      if (!ocr) return;

      let filled = 0;

      if (ocr.product_name?.value) {
        setName(String(ocr.product_name.value)); filled++;
      }
      if (ocr.brand?.value) {
        setBrand(String(ocr.brand.value)); filled++;
      }
      if (ocr.sell_price?.value != null && Number(ocr.sell_price.value) > 0) {
        // Backend stores price in pesawas → convert to GHS for display
        setSellPrice(String((Number(ocr.sell_price.value) / 100).toFixed(2))); filled++;
      }
      if (ocr.buy_price?.value != null && Number(ocr.buy_price.value) > 0) {
        setBuyPrice(String((Number(ocr.buy_price.value) / 100).toFixed(2))); filled++;
      }
      if (ocr.quantity?.value) {
        setStock(String(ocr.quantity.value)); filled++;
      }

      setOcrAttempted(true);
      setOcrDone(filled > 0);

      // clear() resets result AND launchedForBarcode so the next scan can fire fresh
      snap.clear();
    }, [])
  );

  // ── Category auto-suggest (debounced 500 ms) ─────────────────────────────
  useEffect(() => {
    if (name.length < 3) return;
    if (catDebounceRef.current) clearTimeout(catDebounceRef.current);
    catDebounceRef.current = setTimeout(() => {
      productsApi.suggestCategory({ name, brand, barcode }).then(r => {
        setSuggestion(r.data.suggestion);
        if (!categoryId) setCategoryId(r.data.suggestion.category_id);
      }).catch(() => {});
    }, 500);
    return () => { if (catDebounceRef.current) clearTimeout(catDebounceRef.current); };
  }, [name]);

  // ── Save / Update ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Missing field', 'Product name is required'); return; }
    if (!sellPrice)   { Alert.alert('Missing field', 'Sell price is required'); return; }
    if (!buyPrice)    { Alert.alert('Missing field', 'Buy price is required'); return; }
    if (!categoryId)  { Alert.alert('Missing field', 'Please select a category'); return; }

    const sellP = Math.round(parseFloat(sellPrice) * 100);
    const buyP  = Math.round(parseFloat(buyPrice)  * 100);

    if (isNaN(sellP) || sellP <= 0) { Alert.alert('Invalid price', 'Enter a valid sell price'); return; }
    if (isNaN(buyP)  || buyP  <= 0) { Alert.alert('Invalid price', 'Enter a valid buy price'); return; }

    setSaving(true);
    try {
      if (existingProductId) {
        await productsApi.update(existingProductId, {
          sell_price_pesawas: sellP,
          buy_price_pesawas:  buyP,
        });
      } else {
        await productsApi.create({
          name: name.trim(), barcode: barcode ?? '', category_id: categoryId,
          sell_price_pesawas: sellP, buy_price_pesawas: buyP,
          initial_stock: parseInt(stock, 10) || 1,
        });
      }
      router.replace('/(main)/(tabs)/dash');
    } catch {
      Alert.alert('Error', 'Could not save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Retry label scan manually ────────────────────────────────────────────
  const handleRescan = () => {
    // Allow re-launch: clear the guard for this barcode only
    useOcrLabelStore.getState().clear();
    if (barcode) useOcrLabelStore.getState().setLaunchedForBarcode(barcode);
    setOcrAttempted(false);
    router.push('/(main)/camera-label');
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title={existingProductId ? 'Update Product' : 'New Product'} subtitle={barcode || 'Manual Entry'} />
      <ScrollView contentContainerStyle={{ padding: Spacing.s4 }}>

        {/* Status banner */}
        <View style={[
          styles.ocrBanner,
          ocrAttempted && !ocrDone && styles.ocrBannerWarn,
          existingProductId && styles.ocrBannerSuccess,
          ocrDone && !existingProductId && styles.ocrBannerSuccess,
        ]}>
          <View style={styles.ocrBannerLeft}>
            <Text style={styles.ocrBannerIcon}>
              {existingProductId ? '📦' : ocrDone ? '✓' : ocrAttempted ? '⚠️' : '📷'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.ocrBannerTitle}>
                {existingProductId
                  ? 'Product found — update if needed'
                  : ocrDone
                  ? 'Label scanned — confirm fields'
                  : ocrAttempted
                  ? 'Could not read label — fill in manually'
                  : barcode
                  ? 'Opening camera to scan label…'
                  : 'Manual entry'}
              </Text>
              <Text style={styles.ocrBannerSub}>
                {existingProductId
                  ? `Barcode ${barcode} is in your inventory`
                  : barcode
                  ? `Barcode: ${barcode}`
                  : 'No barcode — add manually'}
              </Text>
            </View>
          </View>
          {!existingProductId && (
            <Pressable
              style={[styles.ocrBtn, ocrAttempted && styles.ocrBtnRescan]}
              onPress={handleRescan}
            >
              <Text style={styles.ocrBtnText}>{ocrAttempted || ocrDone ? 'Retry' : 'Scan'}</Text>
            </Pressable>
          )}
        </View>

        {/* AI category suggestion badge */}
        {suggestion && (
          <View style={styles.aiBanner}>
            <Text style={styles.aiText}>📂 Category: {suggestion.name}</Text>
            <Badge label={`${Math.round(suggestion.confidence * 100)}%`} variant="green" />
          </View>
        )}

        <FormInput label="Product Name *" value={name} onChangeText={setName} placeholder="e.g. Indomie 70g Chicken" />
        <FormInput label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="e.g. Indomie" />

        <View style={{ flexDirection: 'row', gap: Spacing.s3 }}>
          <View style={{ flex: 1 }}>
            <FormInput label="Sell Price (GHS) *" value={sellPrice} onChangeText={setSellPrice} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput label="Buy Price (GHS) *" value={buyPrice} onChangeText={setBuyPrice} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>

        <FormInput label="Initial Stock" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="1" />

        <Button
          label={categoryId ? `Category: ${suggestion?.name ?? 'Selected ✓'}` : 'Select Category *'}
          variant="secondary"
          onPress={() => router.push({ pathname: '/(main)/cat', params: { categoryId } })}
        />

        <Button
          label={saving ? 'Saving…' : existingProductId ? 'Update Product' : 'Save Product'}
          onPress={handleSave}
          loading={saving}
        />
        <Button label="Discard" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ocrBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.w, borderRadius: Radius.md, padding: Spacing.s3,
    marginBottom: Spacing.s3, borderWidth: 1.5, borderColor: Colors.gy2,
  },
  ocrBannerWarn:    { borderColor: Colors.at, backgroundColor: Colors.a },
  ocrBannerSuccess: { borderColor: Colors.g,  backgroundColor: Colors.gl },
  ocrBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.s2, flex: 1 },
  ocrBannerIcon: { fontSize: 22 },
  ocrBannerTitle: { ...Typography.titleSM, color: Colors.t },
  ocrBannerSub:   { ...Typography.bodySM, color: Colors.t2, marginTop: 2 },
  ocrBtn: {
    backgroundColor: Colors.g, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.s3, paddingVertical: 8,
  },
  ocrBtnRescan: { backgroundColor: Colors.at },
  ocrBtnText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gx, borderRadius: Radius.md,
    padding: Spacing.s3, marginBottom: Spacing.s3,
  },
  aiText: { ...Typography.bodyMD, color: Colors.g, flex: 1, marginRight: 8 },
});
