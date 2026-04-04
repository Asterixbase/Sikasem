/**
 * Sikasem Design Tokens — Colour Palette
 * Hybrid B+C: Light (main app) + Dark (scanner screens)
 * Build 14 — updated to design-system branch (teal palette, sunlight-optimised)
 */

export const Colors = {
  // ── Brand — Teal ──────────────────────────────────────────────────────
  g:   '#0F766E',   // Primary — CTAs, nav active, hero cards
  g2:  '#059669',   // Success states, bar chart fills, positive deltas
  gl:  '#F0FDFA',   // Primary light bg — metric card tints, AI banners
  gx:  '#CCFBF1',   // Deeper tint — selected row backgrounds

  // ── Semantic — Amber (warning) ────────────────────────────────────────
  a:   '#FFFBEB',   // Warning backgrounds
  at:  '#D97706',   // Warning text, high-urgency labels

  // ── Semantic — Red (critical) ─────────────────────────────────────────
  r:   '#FFF1F2',   // Critical backgrounds, FAILED status rows
  rt:  '#E11D48',   // Critical text, OVERDUE badges

  // ── Semantic — Blue (info) ────────────────────────────────────────────
  b:   '#EFF6FF',   // Info backgrounds, MoMo status
  bt:  '#0284C7',   // Info text, OCR confidence blue

  // ── Neutrals ──────────────────────────────────────────────────────────
  gy:  '#F8FAFC',   // Page/card backgrounds, metric tiles
  gy2: '#E2E8F0',   // Borders, dividers, separators
  t:   '#0F172A',   // Primary text (slate-900)
  t2:  '#475569',   // Secondary text, labels, timestamps
  t3:  '#94A3B8',   // Tertiary/placeholder text
  w:   '#FFFFFF',   // White

  // ── WhatsApp ──────────────────────────────────────────────────────────
  wa:       '#25D366',
  waHeader: '#075E54',
  waChatBg: '#ece5dd',
  waBubbleIn:  '#FFFFFF',
  waBubbleOut: '#dcf8c6',
  waDark:   '#128C7E',

  // ── Admin / Dark shell ────────────────────────────────────────────────
  shellBg:      '#0d0d1a',
  shellSidebar: '#13131f',
  shellBorder:  '#1e1e2e',
  csvBg:        '#1a1a2e',
  csvText:      '#a8dfbc',

  // ── Scanner dark theme (Variation C) ─────────────────────────────────
  scanBg:      '#111827',
  scanCard:    '#1F2937',
  scanBorder:  '#374151',
  scanPrimary: '#10B981',   // Vivid emerald — most visible on dark in sunlight
  scanAccent:  '#FBBF24',
  scanText:    '#F9FAFB',
  scanTextSec: '#D1D5DB',

  // ── Log severity border colours ───────────────────────────────────────
  severity: {
    success:  '#0F766E',
    warning:  '#D97706',
    critical: '#E11D48',
    info:     '#0284C7',
  },
} as const;

export type ColorKey = keyof typeof Colors;

/** Badge variant colours */
export const BadgeColors = {
  green: { bg: '#F0FDFA', text: '#059669' },
  amber: { bg: '#FFFBEB', text: '#D97706' },
  red:   { bg: '#FFF1F2', text: '#E11D48' },
  blue:  { bg: '#EFF6FF', text: '#0284C7' },
} as const;

/** Credit status badge colours */
export const CreditStatus = {
  overdue:     { bg: '#E11D48', text: '#FFFFFF' },
  dueTomorrow: { bg: '#BE123C', text: '#FFFFFF' },
  pending:     { bg: '#E2E8F0', text: '#475569' },
  paid:        { bg: '#F0FDFA', text: '#059669' },
} as const;
