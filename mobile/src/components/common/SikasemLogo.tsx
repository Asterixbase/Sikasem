import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants';

type Size = 'sm' | 'md' | 'lg';
type Layout = 'row' | 'column';

interface Props {
  size?: Size;
  layout?: Layout;
  showTagline?: boolean;
}

const SCALE: Record<Size, {
  mark: number;   // circle diameter
  symbol: number; // ₵ font size inside circle
  name: number;   // SIKASEM font size
  tagline: number;
  gap: number;    // gap between mark and wordmark
  wordGap: number;// gap between name and tagline
}> = {
  sm: { mark: 30, symbol: 13, name: 14, tagline: 10, gap: 6,  wordGap: 2 },
  md: { mark: 44, symbol: 18, name: 18, tagline: 11, gap: 9,  wordGap: 3 },
  lg: { mark: 64, symbol: 26, name: 22, tagline: 12, gap: 12, wordGap: 4 },
};

export function SikasemLogo({ size = 'md', layout = 'row', showTagline = true }: Props) {
  const d = SCALE[size];
  const isCol = layout === 'column';

  return (
    <View style={[
      styles.root,
      isCol ? styles.rootCol : styles.rootRow,
      { gap: d.gap },
    ]}>

      {/* ── Icon mark ── */}
      <View style={[
        styles.mark,
        { width: d.mark, height: d.mark, borderRadius: d.mark / 2 },
      ]}>
        <Text
          style={[styles.symbol, { fontSize: d.symbol, lineHeight: d.mark }]}
          allowFontScaling={false}
        >
          ₵
        </Text>
      </View>

      {/* ── Wordmark ── */}
      <View style={[styles.words, isCol && styles.wordsCenter, { gap: d.wordGap }]}>
        <Text
          style={[styles.name, { fontSize: d.name, letterSpacing: d.name * 0.09 }]}
          allowFontScaling={false}
        >
          SIKASEM
        </Text>
        {showTagline && (
          <Text
            style={[styles.tagline, { fontSize: d.tagline }]}
            allowFontScaling={false}
          >
            sika sem · money works
          </Text>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  rootRow: { flexDirection: 'row' },
  rootCol: { flexDirection: 'column' },

  mark: {
    backgroundColor: Colors.g,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow so it lifts off light backgrounds
    shadowColor: Colors.g,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  symbol: {
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  } as any,

  words: { justifyContent: 'center' },
  wordsCenter: { alignItems: 'center' },

  name: {
    color: Colors.g,
    fontWeight: '900',
  },
  tagline: {
    color: Colors.t2,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
