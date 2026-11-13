// The locked fonts (see CLAUDE.md) for the native apps: Inter for English and
// UI text, Noto Sans Tamil for Tamil, JetBrains Mono for IDs and references.
// Each app's root layout passes `lockedFonts` to expo-font's useFonts() before
// showing any text.
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  NotoSansTamil_400Regular,
  NotoSansTamil_600SemiBold,
  NotoSansTamil_700Bold,
} from '@expo-google-fonts/noto-sans-tamil';
import { comfortableTypeScale, lineHeightRatio, typeScale } from '@my-people/design-tokens';

export const lockedFonts = {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  NotoSansTamil_400Regular,
  NotoSansTamil_600SemiBold,
  NotoSansTamil_700Bold,
  JetBrainsMono_400Regular,
};

/** The loaded monospace font, for member IDs and reference numbers. */
export const monoFontFamily = 'JetBrainsMono_400Regular';

type Weight = 400 | 600 | 700;
export type TypographyScale = 'default' | 'comfortable';

/** The loaded font for a language and weight. Native apps cannot fall back per glyph, so Tamil gets its own font. */
export function fontFamilyFor(language: string, weight: Weight): string {
  const suffix = weight === 700 ? '700Bold' : weight === 600 ? '600SemiBold' : '400Regular';
  return language === 'ta' ? `NotoSansTamil_${suffix}` : `Inter_${suffix}`;
}

/** Font, size and line height for a step of the type scale. */
export function textStyle(language: string, step: keyof typeof typeScale, scale: TypographyScale = 'default') {
  const selectedScale = scale === 'comfortable' ? comfortableTypeScale : typeScale;
  const { size, lineHeight, weight } = selectedScale[step];
  // Text must remain readable when system font scaling expands Tamil glyphs.
  // Keep every shared text step above the 1.4 accessibility baseline; Tamil
  // still gets its larger script-specific leading.
  const accessibleLineHeight = Math.ceil(size * 1.45);
  const tamilLineHeight = Math.ceil(size * lineHeightRatio.tamil);
  return {
    fontFamily: fontFamilyFor(language, weight),
    fontSize: size,
    lineHeight: language === 'ta'
      ? Math.max(lineHeight, accessibleLineHeight, tamilLineHeight)
      : Math.max(lineHeight, accessibleLineHeight),
  };
}
