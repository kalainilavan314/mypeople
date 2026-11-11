// The fonts of the native apps (CLAUDE.md): Outfit for English and UI text (the owner's choice on
// 11 November 2026), Noto Sans Tamil for Tamil, JetBrains Mono for IDs and references. Each app's
// root layout passes `appFonts` to expo-font's useFonts() before showing any text.
// One import per weight, so a build carries only the weights the apps load, not the whole family.
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { NotoSansTamil_400Regular } from '@expo-google-fonts/noto-sans-tamil/400Regular';
import { NotoSansTamil_600SemiBold } from '@expo-google-fonts/noto-sans-tamil/600SemiBold';
import { NotoSansTamil_700Bold } from '@expo-google-fonts/noto-sans-tamil/700Bold';
import { Outfit_300Light } from '@expo-google-fonts/outfit/300Light';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { lineHeightRatio, typeScale, type FontWeight } from '@my-people/design-tokens/mobile';

export const appFonts = {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  NotoSansTamil_400Regular,
  NotoSansTamil_600SemiBold,
  NotoSansTamil_700Bold,
  JetBrainsMono_400Regular,
};

/** The loaded monospace font, for member IDs and reference numbers. */
export const monoFontFamily = 'JetBrainsMono_400Regular';

const OUTFIT: Record<FontWeight, string> = {
  300: 'Outfit_300Light',
  400: 'Outfit_400Regular',
  500: 'Outfit_500Medium',
  600: 'Outfit_600SemiBold',
  700: 'Outfit_700Bold',
};

// Noto Sans Tamil is loaded in three weights; the lighter steps read as Regular, Medium as SemiBold.
const TAMIL: Record<FontWeight, string> = {
  300: 'NotoSansTamil_400Regular',
  400: 'NotoSansTamil_400Regular',
  500: 'NotoSansTamil_600SemiBold',
  600: 'NotoSansTamil_600SemiBold',
  700: 'NotoSansTamil_700Bold',
};

/** The loaded font for a language and weight. Native apps cannot fall back per glyph, so Tamil gets its own font. */
export function fontFamilyFor(language: string, weight: FontWeight): string {
  return language === 'ta' ? TAMIL[weight] : OUTFIT[weight];
}

/** textStyle with the size and line height multiplied by the member's in-app text size (M44). */
export function scaledTextStyle(language: string, step: keyof typeof typeScale, scale: number) {
  const base = textStyle(language, step);
  return { ...base, fontSize: Math.round(base.fontSize * scale), lineHeight: Math.ceil(base.lineHeight * scale) };
}

// Noto Sans Tamil sets much wider than Outfit; the largest steps come down a little so Tamil headings
// keep to the same lines the English ones do.
const TAMIL_SIZE: Partial<Record<keyof typeof typeScale, number>> = { display: 26, page: 24, section: 18, card: 16 };

/** Font, size and line height for a step of the type scale. */
export function textStyle(language: string, step: keyof typeof typeScale) {
  const { size: latinSize, lineHeight, weight } = typeScale[step];
  const tamil = language === 'ta';
  const size = tamil ? TAMIL_SIZE[step] ?? latinSize : latinSize;
  // Text must remain readable when system font scaling expands Tamil glyphs: every step keeps
  // above the 1.4 accessibility baseline, and Tamil gets its larger script-specific leading.
  const accessibleLineHeight = Math.ceil(size * 1.4);
  const tamilLineHeight = Math.ceil(size * lineHeightRatio.tamil);
  return {
    fontFamily: fontFamilyFor(language, weight),
    fontSize: size,
    lineHeight: tamil ? Math.max(lineHeight, accessibleLineHeight, tamilLineHeight) : Math.max(lineHeight, accessibleLineHeight),
  };
}
