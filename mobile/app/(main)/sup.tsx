import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  Badge,
  HorizontalBar,
  LoadingState,
  ErrorState,
} from '@/components';

interface SupplierPrice {
  supplier_name: string;
  price_pesawas: number;
  rank: 'r1' | 'r2' | string;
}
interface ProductSupplier {
  product_id: string;
  name: string;
  emoji: string;
  price_index: number;
  suppliers: SupplierPrice[];
}
interface SupplierPricesData {
  products: ProductSupplier[];
}

function rankBadge(rank: string) {
  if (rank === 'r1') return { label: '#1 BEST', bg: '#ffd700', text: '#5a3e00' };
  if (rank === 'r2') return { label: '#2', bg: '#c0c0c0', text: '#333' };
  return null;
}

export default function SupplierPricesScreen() {
  const { data, isLoading, error } = useQuery<SupplierPricesData>({
    queryKey: ['supplierPrices'],
    queryFn: () => analyticsApi.supplierPrices().then(r => r.data),
  });

  if (isLoading) return <LoadingState message="Loading supplier prices…" />;
  if (error || !data) return <ErrorState message="Could not load supplier price data" />;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Supplier Prices" subtitle="ARCHIVED INSIGHTS / Last 3 purchases" />
      <SafeScrollView>
        {/* Insight banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>💡</Text>
          <Text style={styles.bannerText}>
            Switching suppliers could save GHS 124/month on your current purchase mix
          </Text>
        </View>

        {/* Product cards */}
        {data.products.map(product => {
          const maxPrice = Math.max(...product.suppliers.map(s => s.price_pesawas), 1);
          const minPrice = Math.min(...product.suppliers.map(s => s.price_pesawas));
          return (
            <Pressable
              key={product.product_id}
              style={styles.card}
              onPress={() => router.push(`/(main)/price-history?product_id=${product.product_id}`)}
            >
              {/* Card header */}
              <View style={styles.cardHeader}>
                <Text style={styles.productEmoji}>{product.emoji}</Text>
                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                <View style={styles.indexBadge}>
                  <Text style={styles.indexLabel}>INDEX</Text>
                  <Text style={styles.indexValue}>{product.price_index.toFixed(2)}</Text>
                </View>
              </View>

              {/* Supplier price bars */}
              {product.suppliers.map((s, i) => {
                const badge = rankBadge(s.rank);
                const isCheapest = s.price_pesawas === minPrice;
                return (
                  <View key={i} style={styles.supplierRow}>
                    <View style={styles.supplierMeta}>
                      <Text style={styles.supplierName} numberOfLines={1}>{s.supplier_name}</Text>
                      {badge ? (
                        <View style={[styles.rankBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.rankBadgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      ) : null}
                    </View>
                    <HorizontalBar
                      label=""
                      value={`GHS ${(s.price_pesawas / 100).toFixed(2)}`}
                      pct={(s.price_pesawas / maxPrice) * 100}
                      color={isCheapest ? Colors.g2 : Colors.t2}
                    />
                  </View>
                );
              })}
            </Pressable>
          );
        })}
      </SafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gy },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gl,
    margin: Spacing.s4,
    borderRadius: Radius.lg,
    padding: Spacing.s4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.g,
    gap: Spacing.s2,
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { ...Typography.bodyMD, color: Colors.g, flex: 1, lineHeight: 18 },
  card: {
    backgroundColor: Colors.w,
    margin: Spacing.s4,
    marginTop: 0,
    borderRadius: Radius.lg,
    padding: Spacing.s5,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.s3,
    gap: Spacing.s2,
  },
  productEmoji: { fontSize: 22 },
  productName: { ...Typography.titleSM, color: Colors.t, flex: 1 },
  indexBadge: {
    backgroundColor: Colors.b,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  indexLabel: { ...Typography.micro, color: Colors.bt },
  indexValue: { ...Typography.badge, color: Colors.bt, fontWeight: '700' },
  supplierRow: { marginBottom: Spacing.s2 },
  supplierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    marginBottom: 2,
  },
  supplierName: { ...Typography.bodySM, color: Colors.t2, flex: 1 },
  rankBadge: {
    borderRadius: Radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rankBadgeText: { fontSize: 9, fontWeight: '700' },
});
