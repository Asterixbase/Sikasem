/**
 * Sikasem Design Tokens — Typography
 * Font: Plus Jakarta Sans (primary), Inter (fallback)
 */

export const typography = {
  fontFamily: {
    display: 'PlusJakartaSans-Bold',
    heading: 'PlusJakartaSans-SemiBold',
    body: 'PlusJakartaSans-Regular',
    mono: 'JetBrainsMono-Regular',
  },
  scale: {
    displayLg: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
    displayMd: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
    headingLg: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
    headingMd: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
    headingSm: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
    bodyLg:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    bodyMd:    { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
    bodySm:    { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
    caption:   { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
    overline:  { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  },
} as const;
