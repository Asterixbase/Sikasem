/**
 * Responsive layout helpers
 * All screens should use these instead of hardcoded px values for padding/width.
 */
import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Horizontal screen padding — scales with screen width */
export const screenPad = Math.max(16, Math.min(24, SCREEN_W * 0.045));

/** Card horizontal margin */
export const cardMx = screenPad;

/** Safe bottom inset for footer bars (above tab bar) */
export const safeBottom = Platform.OS === 'ios' ? 100 : 80;

/** True if this is a small phone (SE / Pixel 4a) */
export const isSmallScreen = SCREEN_W < 376;

/** True if this is a tablet */
export const isTablet = SCREEN_W >= 768;

/** Scale a font size relative to the reference 390px design width */
export function scaleFont(size: number): number {
  const scale = SCREEN_W / 390;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
}

/** Scale a spacing value relative to the reference 390px design width */
export function scaleSpacing(size: number): number {
  if (isTablet) return size * 1.25;
  if (isSmallScreen) return size * 0.9;
  return size;
}

export { SCREEN_W, SCREEN_H };
