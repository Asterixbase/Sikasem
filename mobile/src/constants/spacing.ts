/**
 * Sikasem Design Tokens — Spacing (8px base grid) + Border Radius + Shadows
 * Build 14 — aligned to design-system branch
 * Touch targets: minimum 44px, recommended 48px (sunlight/outdoor use)
 */
import { ViewStyle } from 'react-native';

export const Spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,   // Screen horizontal padding (was 14, now proper 8px grid)
  s5: 20,
  s6: 24,
  s8: 32,
} as const;

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   16,
  xl:   20,
  full: 9999,
} as const;

export const Shadows: Record<string, ViewStyle> = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  fab: {
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
} as const;
