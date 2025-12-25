import { PixelRatio, Platform } from 'react-native';

export type Variant = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'caption' | 'small';

// Base sizes in px (mobile-first)
export const baseSizes: Record<Variant, number> = {
  h1: 40,
  h2: 28,
  h3: 24,
  title: 20,
  body: 16,
  caption: 13,
  small: 12,
};

// Line-height multiplier
export const LINE_HEIGHT_MULT = 1.3;

// Normalize on Android/iOS using PixelRatio font scale to keep visual parity
export function normalizeForMobile(size: number) {
  try {
    const fontScale = PixelRatio.getFontScale();
    // If user increased system font, divide to preserve visual size
    return Math.round(size / fontScale);
  } catch (e) {
    return size;
  }
}

// Expose a simple resolver for a variant applying mobile normalization
export function resolveMobileSize(variant: Variant) {
  const base = baseSizes[variant];
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return normalizeForMobile(base);
  }
  return base;
}

export default {
  baseSizes,
  LINE_HEIGHT_MULT,
  normalizeForMobile,
  resolveMobileSize,
};
