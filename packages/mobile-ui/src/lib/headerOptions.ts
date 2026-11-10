import { colors } from '@my-people/design-tokens';
import { fontFamilyFor } from '../fonts';

/** Header styling for the stacks: white bar, navy back arrow, title in the locked font. */
export function headerOptions(language: string) {
  return {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
    // Without a back title the button is announced with the previous route's
    // name, e.g. "(tabs), back". "Back" makes it "Go back".
    headerBackTitle: language === 'ta' ? 'பின்செல்' : 'Back',
    contentStyle: { backgroundColor: colors.page },
  };
}
