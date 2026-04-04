/**
 * Sikasem Design Tokens — Colors
 * Hybrid B+C: Light (main app) + Dark (scanner screens)
 * Generated from Figma: https://www.figma.com/design/4lfprfagF9R6Yisgy3MZkL
 */

export const colors = {
  // ── Light Theme (Variation B — Main App) ──
  light: {
    brand: {
      primary: '#0F766E',
      primaryLight: '#F0FDFA',
      primaryDark: '#0A5048',
      accent: '#F59E0B',
    },
    semantic: {
      success: '#059669',
      warning: '#D97706',
      error: '#E11D48',
      info: '#0284C7',
      critical: '#BE123C',
      pending: '#CA8A04',
    },
    surface: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      elevated: '#F1F5F9',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      tertiary: '#94A3B8',
      inverse: '#FFFFFF',
    },
    border: {
      default: '#E2E8F0',
      strong: '#CBD5E1',
    },
    nav: {
      active: '#0F766E',
      inactive: '#94A3B8',
    },
  },

  // ── Dark Theme (Variation C — Scanner Screens) ──
  dark: {
    brand: {
      primary: '#10B981',
      primaryLight: '#064E3B',
      primaryDark: '#059669',
      accent: '#FBBF24',
    },
    semantic: {
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      info: '#60A5FA',
    },
    surface: {
      background: '#111827',
      card: '#1F2937',
      elevated: '#374151',
    },
    text: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary: '#6B7280',
      inverse: '#111827',
    },
    border: {
      default: '#374151',
      strong: '#4B5563',
    },
    nav: {
      active: '#10B981',
      inactive: '#6B7280',
    },
  },
} as const;

export type ColorTheme = typeof colors.light;
export type Colors = typeof colors;
