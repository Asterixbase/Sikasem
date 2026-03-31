import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, FormInput, Button, Badge } from '@/components';

export default function ScanResultScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [suggestion, setSuggestion] = useState<{name:string;confidence:number}|null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (name.length > 2) {
      productsApi.suggestCategory({ name, brand, barcode }).then(r => {
        setSuggestion(r.data.suggestion);
        setCategoryId(r.data.suggestion.category_id);
      }).catch(() => {});
    }
  }, [name]);

  const handleSave = async () => {
    if (!name || !sellPrice || !buyPrice || !categoryId) {
      Alert.alert('Incomplete', 'Please fill all fields'); return;
    }
    setSaving(true);
    try {
      await productsApi.create({
        name, barcode, category_id: categoryId,
        sell_price_pesawas: Math.round(parseFloat(sellPrice) * 100),
        buy_price_pesawas: Math.round(parseFloat(buyPrice) * 100),
        initial_stock: parseInt(stock, 10),
      });
      router.replace('/(main)/dash');
    } catch {
      Alert.alert('Error', 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="New Product" subtitle={barcode} />
      <ScrollView contentContainerStyle={{ padding: Spacing.s4 }}>
        {suggestion && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>AI Suggestion: {suggestion.name}</Text>
            <Badge label={`${suggestion.confidence}%`} variant="green" />
          </View>
        )}
        <FormInput label="Product Name" value={name} onChangeText={setName} placeholder="e.g. Indomie 70g Chicken" />
        <FormInput label="Brand (optional)" value={brand} onChangeText={setBrand} />
        <FormInput label="Sell Price (GHS)" value={sellPrice} onChangeText={setSellPrice} keyboardType="decimal-pad" />
        <FormInput label="Buy Price (GHS)" value={buyPrice} onChangeText={setBuyPrice} keyboardType="decimal-pad" />
        <FormInput label="Initial Stock" value={stock} onChangeText={setStock} keyboardType="number-pad" />
        <Button label="Category: " variant="secondary" onPress={() => router.push({ pathname:'/(main)/cat', params:{categoryId} })} />
        <Button label="Save Product" onPress={handleSave} loading={saving} />
        <Button label="Discard" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gx, borderRadius: Radius.md, padding: Spacing.s3, marginBottom: Spacing.s3,
  },
  bannerText: { ...Typography.bodyMD, color: Colors.g, flex: 1, marginRight: 8 },
});
