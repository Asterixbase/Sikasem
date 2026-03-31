/**
 * Sikasem v1.3 Design Tokens — Spacing (4px grid) + Border Radius + Shadows
 */
import { ViewStyle } from 'react-native';

export const Spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 14,   // Screen horizontal padding
  s5: 16,
  s6: 18,
  s8: 32,
} as const;

export const Radius = {
  xs:   5,
  sm:   8,
  md:  10,
  lg:  12,
  xl:  14,
  full: 9999,
} as const;

export const Shadows: Record<string, ViewStyle> = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;
