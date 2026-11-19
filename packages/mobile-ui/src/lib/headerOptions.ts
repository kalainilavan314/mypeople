import { colors, comfortableTypeScale, typeScale } from '@my-people/design-tokens/mobile';
import { fontFamilyFor, tamilSize, type TypographyScale } from '../fonts';

/** Header styling for the stacks: quiet page chrome with one brand-coloured affordance. */
export function headerOptions(language: string, scale: TypographyScale = 'default') {
  const title = scale === 'comfortable' ? comfortableTypeScale.title : typeScale.title;
  return {
    headerStyle: { backgroundColor: colors.page },
    headerShadowVisible: false,
    headerTintColor: colors.primary,
    headerTitleAlign: 'center' as const,
    // A long title (common in Tamil) is cut with an ellipsis; this keeps a gap between it and the back arrow.
    headerTitleContainerStyle: { paddingHorizontal: 8 },
    headerTitleStyle: {
      fontFamily: fontFamilyFor(language, title.weight),
      fontSize: language === 'ta' ? tamilSize(title.size) : title.size,
      color: colors.text,
    },
    headerBackButtonDisplayMode: 'minimal' as const,
    // Without a back title the button is announced with the previous route's
    // name, e.g. "(tabs), back". "Back" makes it "Go back".
    headerBackTitle: language === 'ta' ? 'பின்செல்' : 'Back',
    contentStyle: { backgroundColor: colors.page },
  };
}
