/**
 * Sikasem v1.3 Design Tokens — Colour Palette
 * All values verified from Sikasem_Interactive_Prototype_v3.html
 */

export const Colors = {
  // Brand Greens
  g:  '#1B6B3A',   // CTAs, nav active, hero cards, brand bar
  g2: '#2e7d32',   // Success states, bar chart fills, hover
  gl: '#e8f5e9',   // Success backgrounds, metric card hover
  gx: '#f0fdf4',   // Page tints, AI suggestion banners

  // Semantic — Amber (warning)
  a:  '#fff3e0',   // Amber warning backgrounds
  at: '#e65100',   // Amber warning text, high-urgency labels

  // Semantic — Red (critical)
  r:  '#ffebee',   // Critical backgrounds, FAILED status rows
  rt: '#c62828',   // Critical text, OVERDUE badges, FAILED

  // Semantic — Blue (info)
  b:  '#e3f2fd',   // Info backgrounds, MoMo status
  bt: '#1565c0',   // Info text, OCR confidence blue

  // Neutrals
  gy:  '#f8f8f8',  // Card backgrounds, metric tiles, input backgrounds
  gy2: '#e5e5e5',  // Borders, dividers, separators
  t:   '#111111',  // Primary text
  t2:  '#888888',  // Secondary text, labels, timestamps
  w:   '#ffffff',  // White
  wa:  '#25D366',  // WhatsApp CTA buttons

  // WhatsApp UI (inline — not in main palette)
  waHeader:   '#075E54',
  waChatBg:   '#ece5dd',
  waBubbleIn: '#ffffff',   // Incoming — credit confirmation (NOT editable)
  waBubbleOut:'#dcf8c6',   // Outgoing — supplier order (EDITABLE)
  waDark:     '#128C7E',

  // Admin / Dark Shell
  shellBg:      '#0d0d1a',
  shellSidebar: '#13131f',
  shellBorder:  '#1e1e2e',
  csvBg:        '#1a1a2e',
  csvText:      '#a8dfbc',

  // Log card border colours by severity
  severity: {
    success: '#1B6B3A',  // var(--g)
    warning: '#e65100',  // var(--at)
    critical:'#c62828',  // var(--rt)
    info:    '#1565c0',  // var(--bt)
  },
} as const;

export type ColorKey = keyof typeof Colors;

/** Badge variant colours */
export const BadgeColors = {
  green:  { bg: '#e8f5e9', text: '#2e7d32' },  // .bdg.bg
  amber:  { bg: '#fff3e0', text: '#e65100' },  // .bdg.ba
  red:    { bg: '#ffebee', text: '#c62828' },  // .bdg.br
  blue:   { bg: '#e3f2fd', text: '#1565c0' },  // .bdg.bb
} as const;

/** Credit status badge colours */
export const CreditStatus = {
  overdue:      { bg: '#c62828', text: '#ffffff' },
  dueTomorrow:  { bg: '#b71c1c', text: '#ffffff' },
  pending:      { bg: '#e5e5e5', text: '#555555' },
  paid:         { bg: '#e8f5e9', text: '#2e7d32' },
} as const;
