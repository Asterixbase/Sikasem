/**
 * Sikasem Design Tokens — Spacing & Layout
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const grid = {
  phone: { columns: 4, gutter: 16, margin: 16, maxWidth: 390 },
  tablet: { columns: 8, gutter: 24, margin: 32, maxWidth: 768 },
} as const;

export const touchTarget = {
  minimum: 44,
  recommended: 48,
} as const;
