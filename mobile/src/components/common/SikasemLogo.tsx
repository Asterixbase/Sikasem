import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants';
import type { LogoVariant } from '@/store/tier';

type Size = 'sm' | 'md' | 'lg';
type Layout = 'row' | 'column';

interface Props {
  size?: Size;
  layout?: Layout;
  showTagline?: boolean;
  variant?: LogoVariant; // A = "S" monogram, B = "SK" square, C = layered ring
  color?: string;        // override brand colour (for tier preview cards)
}

const SCALE: Record<Size, {
  mark: number;
  name: number;
  tagline: number;
  gap: number;
  wordGap: number;
}> = {
  sm: { mark: 30, name: 14, tagline: 10, gap: 6,  wordGap: 2 },
  md: { mark: 44, name: 18, tagline: 11, gap: 9,  wordGap: 3 },
  lg: { mark: 64, name: 22, tagline: 12, gap: 12, wordGap: 4 },
};

// ── Variant A — bold "S" in teal circle ──────────────────────────────────────
function MarkA({ size, brand }: { size: number; brand: string }) {
  const fontSize = size * 0.46;
  return (
    <View style={[
      markBase(size, brand),
      { borderRadius: size / 2 },
    ]}>
      <Text style={{ fontSize, fontWeight: '900', color: '#fff', lineHeight: size, textAlign: 'center' }}
            allowFontScaling={false}>
        S
      </Text>
    </View>
  );
}

// ── Variant B — "SK" initials in rounded square (squircle) ───────────────────
function MarkB({ size, brand }: { size: number; brand: string }) {
  const fontSize = size * 0.3;
  return (
    <View style={[
      markBase(size, brand),
      { borderRadius: size * 0.28 },
    ]}>
      <Text style={{ fontSize, fontWeight: '900', color: '#fff', lineHeight: size, textAlign: 'center', letterSpacing: 1 }}
            allowFontScaling={false}>
        SK
      </Text>
    </View>
  );
}

// ── Variant C — layered ring (outer circle + inner filled circle) ─────────────
function MarkC({ size, brand }: { size: number; brand: string }) {
  const inner = size * 0.55;
  const fontSize = inner * 0.46;
  return (
    <View style={[
      markBase(size, brand),
      { borderRadius: size / 2, borderWidth: size * 0.08, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: brand },
    ]}>
      <View style={{
        width: inner, height: inner, borderRadius: inner / 2,
        backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize, fontWeight: '900', color: brand, lineHeight: inner, textAlign: 'center' }}
              allowFontScaling={false}>
          S
        </Text>
      </View>
    </View>
  );
}

function markBase(size: number, brand: string) {
  return {
    width: size, height: size,
    backgroundColor: brand,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: brand,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export function SikasemLogo({
  size = 'md',
  layout = 'row',
  showTagline = true,
  variant = 'A',
  color,
}: Props) {
  const d = SCALE[size];
  const isCol = layout === 'column';
  const brand = color ?? Colors.g;

  const Mark = variant === 'B' ? MarkB : variant === 'C' ? MarkC : MarkA;

  return (
    <View style={[
      styles.root,
      isCol ? styles.rootCol : styles.rootRow,
      { gap: d.gap },
    ]}>
      <Mark size={d.mark} brand={brand} />

      <View style={[styles.words, isCol && styles.wordsCenter, { gap: d.wordGap }]}>
        <Text
          style={[styles.name, { fontSize: d.name, letterSpacing: d.name * 0.09, color: brand }]}
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
  words: { justifyContent: 'center' },
  wordsCenter: { alignItems: 'center' },
  name: { fontWeight: '900' },
  tagline: { color: Colors.t2, fontWeight: '400', letterSpacing: 0.3 },
});
