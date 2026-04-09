import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, LoadingState, Button } from '@/components';
import { useCategoryPickStore } from '@/store/categoryPick';

interface CatNode { id: string; name: string; children: CatNode[] }

export default function CategoryTreeScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const [selected, setSelected] = useState<string>(categoryId ?? '');
  const [selectedName, setSelectedName] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Create-new-category state
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.getCategories().then(r => r.data),
  });

  const toggle = (id: string) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await productsApi.createCategory({ name: trimmed });
      const newCat = res.data;
      // Auto-select the new category
      setSelected(newCat.id);
      setSelectedName(newCat.name);
      setNewName('');
      // Refresh the category list
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch {
      Alert.alert('Error', 'Could not create category. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderNode = (node: CatNode, depth = 0): React.ReactNode => (
    <View key={node.id}>
      <Pressable
        style={[styles.node, { paddingLeft: Spacing.s4 + depth * 16 }, selected === node.id && styles.nodeSelected]}
        onPress={() => {
          setSelected(node.id);
          setSelectedName(node.name);
          if (node.children.length) toggle(node.id);
        }}
      >
        <Text style={styles.nodeText}>
          {node.children.length ? (expanded.has(node.id) ? '▾ ' : '▸ ') : '  '}{node.name}
        </Text>
        {selected === node.id && <Text style={{ color: Colors.g }}>✓</Text>}
      </Pressable>
      {expanded.has(node.id) && node.children.map(c => renderNode(c, depth + 1))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gy }}>
      <ScreenHeader title="Category" subtitle="SELECT OR CREATE" />

      {/* ── Create new category ── */}
      <View style={styles.createRow}>
        <TextInput
          style={styles.createInput}
          placeholder="New category name…"
          placeholderTextColor={Colors.t2}
          value={newName}
          onChangeText={setNewName}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Pressable
          style={[styles.createBtn, (!newName.trim() || creating) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!newName.trim() || creating}
        >
          {creating
            ? <ActivityIndicator color={Colors.w} size="small" />
            : <Text style={styles.createBtnText}>＋ Add</Text>}
        </Pressable>
      </View>

      {/* ── Category tree ── */}
      {isLoading ? <LoadingState /> : (
        <FlatList
          data={data?.tree ?? []}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <>{renderNode(item)}</>}
          ListEmptyComponent={
            <Text style={styles.empty}>No categories yet — create one above</Text>
          }
        />
      )}

      <Button
        label={selected ? `Confirm: ${selectedName || 'Selected'}` : 'Select a category first'}
        onPress={() => {
          if (selected) {
            useCategoryPickStore.getState().setPick(selected, selectedName);
          }
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  createRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s3,
    gap: Spacing.s2, backgroundColor: Colors.w,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
  },
  createInput: {
    flex: 1, height: 40, borderWidth: 1.5, borderColor: Colors.gy2,
    borderRadius: Radius.md, paddingHorizontal: Spacing.s3,
    ...Typography.bodyMD, color: Colors.t,
  },
  createBtn: {
    backgroundColor: Colors.g, borderRadius: Radius.md,
    paddingHorizontal: Spacing.s4, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnText: { ...Typography.badge, color: Colors.w, fontWeight: '700' },
  node: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.s3, borderBottomWidth: 1, borderBottomColor: Colors.gy,
    backgroundColor: Colors.w,
  },
  nodeSelected: { backgroundColor: Colors.gx },
  nodeText: { ...Typography.bodyLG, color: Colors.t },
  empty: {
    ...Typography.bodyMD, color: Colors.t2, textAlign: 'center',
    padding: Spacing.s6,
  },
});
