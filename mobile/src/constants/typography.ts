/**
 * Sikasem v1.3 Design Tokens — Typography
 */
import { TextStyle } from 'react-native';

export const FontFamily = {
  // System font stack — matches prototype's -apple-system, BlinkMacSystemFont
  sans: undefined as TextStyle['fontFamily'],      // React Native default = system
  mono: 'Courier New' as TextStyle['fontFamily'],  // OCR fields, CSV blocks, timestamps
} as const;

export const Typography: Record<string, TextStyle> = {
  displayXL: { fontSize: 32, fontWeight: '900', lineHeight: 36 },  // Vault balance, OTP
  displayLG: { fontSize: 27, fontWeight: '900', lineHeight: 33 },  // Reorder h1
  displayMD: { fontSize: 23, fontWeight: '900', lineHeight: 30 },  // Tax hero, Vault GHS
  titleLG:   { fontSize: 20, fontWeight: '900', lineHeight: 26 },  // Screen h1
  titleMD:   { fontSize: 17, fontWeight: '800', lineHeight: 22 },  // Section headers
  titleSM:   { fontSize: 15, fontWeight: '700', lineHeight: 20 },  // Screen titles
  bodyLG:    { fontSize: 13, fontWeight: '600', lineHeight: 20 },  // Product names
  bodyMD:    { fontSize: 12, fontWeight: '400', lineHeight: 18 },  // Body copy, form labels
  bodySM:    { fontSize: 11, fontWeight: '400', lineHeight: 18 },  // Sub-labels, timestamps
  label:     { fontSize: 10, fontWeight: '700', lineHeight: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  badge:     { fontSize: 10, fontWeight: '600', lineHeight: 14 },
  micro:     { fontSize: 9,  fontWeight: '500', lineHeight: 13 },
} as const;
