import { colors } from '@my-people/design-tokens';
import { fontFamilyFor } from '../fonts';

/** Header styling for the stacks: quiet page chrome with one brand-coloured affordance. */
export function headerOptions(language: string) {
  return {
    headerStyle: { backgroundColor: colors.page },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.page },
  };
}
