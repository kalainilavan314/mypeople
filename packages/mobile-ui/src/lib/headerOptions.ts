import { colors, comfortableTypeScale } from '@my-people/design-tokens';
import { fontFamilyFor, type TypographyScale } from '../fonts';

/** Header styling for the stacks: quiet page chrome with one brand-coloured affordance. */
export function headerOptions(language: string, scale: TypographyScale = 'default') {
  return {
    headerStyle: { backgroundColor: colors.page },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontFamily: fontFamilyFor(language, 700),
      color: colors.text,
      ...(scale === 'comfortable' ? { fontSize: comfortableTypeScale.section.size } : {}),
    },
    headerBackButtonDisplayMode: 'minimal' as const,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.page },
  };
}
