import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants';
import {
  ScreenHeader,
  SafeScrollView,
  HeroCard,
  Badge,
  Button,
  LoadingState,
  ErrorState,
} from '@/components';

type Urgency = 'critical' | 'high' | 'low';

interface ReorderItem {
  id: string;
  name: string;
  emoji: string;
  urgency: Urgency;
  suggested_qty: number;
  supplier_name: string;
  supplier_matched: boolean;
  price_changed: boolean;
  unit_price_pesawas: number;
}

interface ReorderData {
  items: ReorderItem[];
}

function urgencyColor(u: Urgency): string {
  if (u === 'critical') return Colors.rt;
  if (u === 'high') return Colors.at;
  return Colors.t2;
}

export default function ReorderScreen() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<ReorderData>({
    queryKey: ['reorderSuggestions'],
    queryFn: () => analyticsApi.reorderSuggestions().then(r => r.data),
  });

  const items = data?.items ?? [];

  const allSelected = items.length > 0 && items.every(i => checked.has(i.id));

  function toggleAll() {
    if (allSelected) {
      setChecked(new Set());
    } else {
      setChecked(new Set(items.map(i => i.id)));
    }
  }

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedItems = items.filter(i => checked.has(i.id));
  const selectedCount = selectedItems.length;
  const selectedTotal = selectedItems.reduce(
    (sum, i) => sum + i.unit_price_pesawas * i.suggested_qty,
    0,
  );

  function handlePreviewOrder() {
    const param = encodeURIComponent(JSON.stringify(selectedItems.map(i => i.id)));
    router.push(`/(main)/wa-order?items=${param}`);
  }

  if (isLoading) return <LoadingState message="Loading order suggestions…" />;
  if (error || !data) return <ErrorState message="Could not load reorder suggestions" />;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Order Suggestions" subtitle="INVENTORY SYNC" />
      <SafeScrollView padBottom={false}>
        {/* Hero */}
        <HeroCard
          label="ITEMS NEEDING ATTENTION"
          value={`${items.length} items`}
          subtitle="Based on current stock levels"
        />

        {/* Urgency key */}
        <View style={styles.urgencyKey}>
          {([['critical', 'Critical'], ['high', 'High'], ['low', 'Low']] as [Urgency, string][]).map(
            ([u, label]) => (
              <View key={u} style={styles.urgencyItem}>
                <View style={[styles.urgencyDot, { backgroundColor: urgencyColor(u) }]} />
                <Text style={styles.urgencyLabel}>{label}</Text>
              </View>
            ),
          )}
          <Pressable style={styles.selectAll} onPress={toggleAll}>
            <Text style={styles.selectAllText}>{allSelected ? 'DESELECT ALL' : 'SELECT ALL'}</Text>
          </Pressable>
        </View>

        {/* Checklist */}
        <View style={styles.list}>
          {items.map(item => (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => toggle(item.id)}>
              {/* Checkbox */}
              <View style={[styles.checkbox, checked.has(item.id) && styles.checkboxChecked]}>
                {checked.has(item.id) ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>

              {/* Emoji + name */}
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <View style={styles.itemInfo}>
                <View style={styles.itemNameRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <View
                    style={[styles.urgencyDot, { backgroundColor: urgencyColor(item.urgency) }]}
                  />
                </View>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemQty}>
                    Qty: {item.suggested_qty} · {item.supplier_name}
                  </Text>
                </View>
              </View>

              {/* Status badge */}
              <Badge
                label={item.price_changed ? 'DIFF' : item.supplier_matched ? 'MATCHED' : 'NEW'}
                variant={item.price_changed ? 'amber' : item.supplier_matched ? 'green' : 'blue'}
              />
            </Pressable>
          ))}
        </View>
      </SafeScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerCount}>
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </Text>
          <Text style={styles.footerTotal}>
            GHS {(selectedTotal / 100).toFixed(2)}
          </Text>
        </View>
        <Button
          label="Preview WhatsApp Order →"
          variant="whatsapp"
          disabled={selectedCount === 0}
          onPress={handlePreviewOrder}
          style={styles.footerBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gy },
  urgencyKey: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s2,
    gap: Spacing.s4,
  },
  urgencyItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgencyDot: { width: 9, height: 9, borderRadius: 5 },
  urgencyLabel: { ...Typography.badge, color: Colors.t2 },
  selectAll: { marginLeft: 'auto' },
  selectAllText: { ...Typography.label, color: Colors.g },
  list: {
    backgroundColor: Colors.w,
    margin: Spacing.s4,
    marginTop: 0,
    borderRadius: Radius.lg,
    ...Shadows.card,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.s4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gy2,
    gap: Spacing.s2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.gy2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.g,
    borderColor: Colors.g,
  },
  checkmark: { color: Colors.w, fontSize: 13, fontWeight: '700' },
  itemEmoji: { fontSize: 20 },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName: { ...Typography.bodyLG, color: Colors.t, flex: 1 },
  itemMeta: { marginTop: 2 },
  itemQty: { ...Typography.bodySM, color: Colors.t2 },
  footer: {
    backgroundColor: Colors.w,
    borderTopWidth: 1,
    borderTopColor: Colors.gy2,
    paddingBottom: Spacing.s4,
    paddingTop: Spacing.s3,
    ...Shadows.fab,
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.s5,
    marginBottom: Spacing.s2,
  },
  footerCount: { ...Typography.bodyMD, color: Colors.t2 },
  footerTotal: { ...Typography.titleSM, color: Colors.t },
  footerBtn: { marginHorizontal: Spacing.s4 },
});
