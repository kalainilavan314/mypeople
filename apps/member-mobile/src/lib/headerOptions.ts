import { colors } from '@my-people/design-tokens';
import { fontFamilyFor } from '@my-people/mobile-ui';

/** Header styling for the stacks: white bar, navy back arrow, title in the locked font. */
export function headerOptions(language: string) {
  return {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: colors.page },
  };
}
