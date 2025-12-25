import { useMemo } from 'react';
import { useWindowDimensions, Platform } from 'react-native';
import { Variant, baseSizes, LINE_HEIGHT_MULT, resolveMobileSize } from '../theme/typography';

/**
 * Hook that returns helper to obtain responsive font sizes and styles.
 * Logic:
 * - Android/iOS: use normalized mobile sizes (using PixelRatio fontScale)
 * - Web: treat widths <480 as mobile (use same mobile sizes)
 *   widths 480-599 => mobile or +1px
 *   widths >=600 => base +2px
 */
export function useResponsiveFont() {
  const { width } = useWindowDimensions();

  const mode = useMemo(() => {
    if (Platform.OS === 'web') {
      if (width < 480) return 'mobile';
      if (width >= 480 && width < 600) return 'mobile-lg';
      return 'desktop';
    }
    return 'mobile';
  }, [width]);

  function getSize(variant: Variant) {
    const base = baseSizes[variant];
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      // normalized for mobile user settings
      const mobile = resolveMobileSize(variant);
      return mobile;
    }

    // Web variants
    if (mode === 'mobile') return base;
    if (mode === 'mobile-lg') return base + 1;
    return base + 2;
  }

  function getStyle(variant: Variant) {
    const fontSize = getSize(variant);
    const lineHeight = Math.round(fontSize * LINE_HEIGHT_MULT);
    return {
      fontSize,
      lineHeight,
      // keep fontFamily centralized via App.tsx and web/styles.css (Roboto)
    } as const;
  }

  return { getSize, getStyle, mode } as const;
}

export default useResponsiveFont;
