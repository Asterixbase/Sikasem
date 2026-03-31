import React from 'react';
import { ScrollView, View, StyleSheet, ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants';

interface Props extends ScrollViewProps {
  children: React.ReactNode;
  padBottom?: boolean;
}

export function SafeScrollView({ children, padBottom = true, style, ...props }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={{ paddingBottom: padBottom ? insets.bottom + 80 : 16 }}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.gy },
});
