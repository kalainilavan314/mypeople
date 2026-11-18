import { colors, comfortableTypeScale, tamilComfortableTypeScale, typeScale } from '@my-people/design-tokens/mobile';
import { fontFamilyFor, type TypographyScale } from '../fonts';

/**
 * Header styling for the stacks: a back arrow and a centred title in charcoal on the page colour, so a
 * nested screen reads as part of the page underneath, with no shadow or coloured bar.
 */
export function headerOptions(language: string, scale: TypographyScale = 'default') {
  const tamil = language === 'ta';
  const title = scale === 'comfortable' ? (tamil ? tamilComfortableTypeScale.title : comfortableTypeScale.title) : typeScale.title;
  return {
    headerStyle: { backgroundColor: colors.page },
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleAlign: 'center' as const,
    headerTitleStyle: {
      fontFamily: fontFamilyFor(language, title.weight),
      fontSize: title.size,
      color: colors.text,
    },
    headerBackButtonDisplayMode: 'minimal' as const,
    // Without a back title the button is announced with the previous route's
    // name, e.g. "(tabs), back". "Back" makes it "Go back".
    headerBackTitle: tamil ? 'பின்செல்' : 'Back',
    contentStyle: { backgroundColor: colors.page },
  };
}
