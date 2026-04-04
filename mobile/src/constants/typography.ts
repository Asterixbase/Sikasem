/**
 * Sikasem Design Tokens — Typography
 * Build 14 — updated to design-system branch (sunlight-optimised scale)
 * Font: System (iOS: SF Pro, Android: Roboto) — Plus Jakarta Sans deferred to Build 15
 * Sunlight rules: weight 700+ for key data; min 13px body; no thin/light weights
 */
import { TextStyle } from 'react-native';

export const FontFamily = {
  sans: undefined as TextStyle['fontFamily'],      // System font (SF Pro / Roboto)
  mono: 'Courier New' as TextStyle['fontFamily'],  // OCR fields, CSV blocks, timestamps
} as const;

export const Typography: Record<string, TextStyle> = {
  displayXL: { fontSize: 32, fontWeight: '700', lineHeight: 40 },  // Vault balance, OTP
  displayLG: { fontSize: 28, fontWeight: '700', lineHeight: 36 },  // Reorder h1
  displayMD: { fontSize: 24, fontWeight: '700', lineHeight: 32 },  // Tax hero, sale total
  titleLG:   { fontSize: 20, fontWeight: '600', lineHeight: 28 },  // Screen h1
  titleMD:   { fontSize: 17, fontWeight: '600', lineHeight: 24 },  // Section headers
  titleSM:   { fontSize: 15, fontWeight: '600', lineHeight: 20 },  // Button labels, row titles
  bodyLG:    { fontSize: 16, fontWeight: '400', lineHeight: 24 },  // Product names, form values
  bodyMD:    { fontSize: 14, fontWeight: '400', lineHeight: 20 },  // Body copy, form labels
  bodySM:    { fontSize: 13, fontWeight: '400', lineHeight: 18 },  // Sub-labels, timestamps (min 13px sunlight rule)
  label:     { fontSize: 11, fontWeight: '700', lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
  badge:     { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  micro:     { fontSize: 10, fontWeight: '500', lineHeight: 13 },
} as const;
