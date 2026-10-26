import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { colors, typeScale } from '@my-people/design-tokens';
import { monoFontFamily, textStyle } from '@my-people/mobile-ui';

import { useLanguage } from '@/hooks/useLanguage';

const TONES = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  primary: colors.primary,
  inverse: colors.onPrimary,
  error: colors.error,
  success: colors.successText,
  warning: colors.warningText,
} as const;

type Props = Omit<TextProps, 'style'> & {
  step?: keyof typeof typeScale;
  tone?: keyof typeof TONES;
  /** Member IDs and references: JetBrains Mono, one of the locked fonts. */
  mono?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
};

/** Text in the locked font for the member's language, on the shared type scale. */
export function AppText({ step = 'body', tone = 'default', mono = false, style, children, ...rest }: Props) {
  const language = useLanguage();
  const base = textStyle(language, step);
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={2}
      style={[base, mono && { fontFamily: monoFontFamily }, { color: TONES[tone] }, style]}>
      {children}
    </Text>
  );
}
