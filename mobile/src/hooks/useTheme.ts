/**
 * useTheme — returns a full Colors-compatible object with theme overrides applied.
 *
 * Use this in components/screens wherever Colors.g (primary), Colors.g2 (accent),
 * Colors.gl / Colors.gx (tints), or Colors.scanPrimary need to respond to theme changes.
 *
 * Static, non-primary colours (neutrals, semantic red/amber/blue) are passed through
 * unchanged — they are not theme-specific.
 *
 * Usage:
 *   const C = useTheme();
 *   <View style={{ backgroundColor: C.g }} />
 */
import { Colors } from '@/constants';
import { useThemePalette } from '@/store/theme';

export function useTheme() {
  const t = useThemePalette();
  return {
    ...Colors,
    g:           t.primary,
    g2:          t.accent,
    gl:          t.bgLight,
    gx:          t.bgDeep,
    scanPrimary: t.scanPrimary,
  } as typeof Colors;
}
