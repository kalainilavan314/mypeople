import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { colors, lineHeightRatio, typeScale, type FontWeight } from '@my-people/design-tokens/mobile';
import { useTextScale } from '../display/DisplayPreferences';
import { TAMIL_SIZE_RATIO, fontFamilyFor, monoFontFamily, scaledTextStyle, tamilSize } from '../fonts';
import { useTypographyScale } from './AppTypographyProvider';

import { useLanguage } from '../hooks/useLanguage';

const TONES = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  primary: colors.primary,
  link: colors.link,
  brandAccent: colors.onBrandAccent,
  inverse: colors.onPrimary,
  error: colors.error,
  success: colors.successText,
  warning: colors.warningText,
} as const;

type Props = Omit<TextProps, 'style'> & {
  step?: keyof typeof typeScale;
  tone?: keyof typeof TONES;
  /** Member IDs and references: JetBrains Mono. */
  mono?: boolean;
  /** Overrides the step's weight with the matching loaded font (never `fontWeight`, which custom fonts ignore). */
  weight?: FontWeight;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
};

/**
 * Text in the app font for the member's language (Outfit, or Noto Sans Tamil), on the shared type scale,
 * enlarged by the member's in-app text size (M44). The phone's own font
 * setting still applies on top, capped so the two together stay within twice
 * the base size and layouts remain usable.
 */
export function AppText({ step = 'body', tone = 'default', mono = false, weight, style, children, ...rest }: Props) {
  const language = useLanguage();
  const scale = useTextScale();
  const typography = useTypographyScale();
  const base = scaledTextStyle(language, step, scale, typography);
  const fixes = mono ? null : screenStyleFixes(language, StyleSheet.flatten(style));
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={2 / scale}
      style={[
        base,
        language === 'ta' && styles.tamil,
        weight && { fontFamily: fontFamilyFor(language, weight) },
        mono && { fontFamily: monoFontFamily },
        { color: TONES[tone] },
        style,
        fixes,
      ]}>
      {children}
    </Text>
  );
}

const WEIGHTS: Record<string, FontWeight> = {
  '300': 300,
  '400': 400,
  normal: 400,
  '500': 500,
  '600': 600,
  '700': 700,
  bold: 700,
  '800': 700,
  '900': 700,
};

/**
 * Corrections for sizes and weights that screens set in their own styles:
 * - a `fontWeight` becomes the matching loaded font file, because the fonts carry their weight in the
 *   file and a weight on top makes browsers draw a fake, heavier bold (Tamil looked smudged);
 * - in Tamil, a screen's own font size gets the same step down as the type scale (tamilSize).
 */
function screenStyleFixes(language: string, flat: TextStyle | null | undefined): TextStyle | null {
  if (!flat) return null;
  const fix: { -readonly [K in keyof TextStyle]: TextStyle[K] } = {};
  if (flat.fontWeight !== undefined && !flat.fontFamily) {
    fix.fontFamily = fontFamilyFor(language, WEIGHTS[String(flat.fontWeight)] ?? 400);
    fix.fontWeight = 'normal';
  }
  if (language === 'ta' && typeof flat.fontSize === 'number') {
    const size = tamilSize(flat.fontSize);
    fix.fontSize = size;
    fix.lineHeight = Math.max(
      Math.ceil(size * lineHeightRatio.tamil),
      typeof flat.lineHeight === 'number' ? Math.ceil(flat.lineHeight * TAMIL_SIZE_RATIO) : 0,
    );
  }
  return Object.keys(fix).length > 0 ? fix : null;
}

const styles = StyleSheet.create({
  // Android pads Noto Sans Tamil's tall ascent and descent, which pushes Tamil off centre in buttons and
  // pills; the generous Tamil line height already keeps every vowel sign clear.
  tamil: { includeFontPadding: false, textAlignVertical: 'center' },
});
