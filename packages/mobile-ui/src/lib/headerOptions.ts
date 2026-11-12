import { colors, typeScale } from '@my-people/design-tokens/mobile';
import { fontFamilyFor } from '../fonts';

/** Header styling for the stacks: quiet page chrome with one brand-coloured affordance. */
export function headerOptions(language: string) {
  return {
    headerStyle: { backgroundColor: colors.page },
    headerShadowVisible: false,
    headerTintColor: colors.primary,
    headerTitleAlign: 'center' as const,
    headerTitleStyle: {
      fontFamily: fontFamilyFor(language, typeScale.title.weight),
      fontSize: language === 'ta' ? 17 : typeScale.title.size,
      color: colors.text,
    },
    headerBackButtonDisplayMode: 'minimal' as const,
    // Without a back title the button is announced with the previous route's
    // name, e.g. "(tabs), back". "Back" makes it "Go back".
    headerBackTitle: language === 'ta' ? 'பின்செல்' : 'Back',
    contentStyle: { backgroundColor: colors.page },
  };
}
