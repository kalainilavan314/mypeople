import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { colors, typeScale, type FontWeight } from '@my-people/design-tokens/mobile';
import { useTextScale } from '../display/DisplayPreferences';
import { fontFamilyFor, monoFontFamily, scaledTextStyle } from '../fonts';

import { useLanguage } from '../hooks/useLanguage';

const TONES = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  primary: colors.primary,
  link: colors.link,
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
  const base = scaledTextStyle(language, step, scale);
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={2 / scale}
      style={[base, weight && { fontFamily: fontFamilyFor(language, weight) }, mono && { fontFamily: monoFontFamily }, { color: TONES[tone] }, style]}>
      {children}
    </Text>
  );
}
