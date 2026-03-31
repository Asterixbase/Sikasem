import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { ScreenHeader, LoadingState, Button } from '@/components';

interface CatNode { id: string; name: string; children: CatNode[] }

export default function CategoryTreeScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const [selected, setSelected] = useState<string>(categoryId ?? '');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.getCategories().then(r => r.data),
  });

  const toggle = (id: string) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const renderNode = (node: CatNode, depth = 0): React.ReactNode => (
    <View key={node.id}>
      <Pressable
        style={[styles.node, { paddingLeft: Spacing.s4 + depth * 16 }, selected === node.id && styles.nodeSelected]}
        onPress={() => { setSelected(node.id); if (node.children.length) toggle(node.id); }}
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
      <ScreenHeader title="Category Tree" subtitle="TAP TO DRILL DOWN" />
      {isLoading ? <LoadingState /> : (
        <FlatList
          data={data?.tree ?? []}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <>{renderNode(item)}</>}
        />
      )}
      <Button label="Confirm Category" onPress={() => router.back()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  node: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.s3, borderBottomWidth: 1, borderBottomColor: Colors.gy,
    backgroundColor: Colors.w,
  },
  nodeSelected: { backgroundColor: Colors.gx },
  nodeText: { ...Typography.bodyLG, color: Colors.t },
});
