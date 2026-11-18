import { colors } from '@my-people/design-tokens/mobile';
import { fontFamilyFor } from '../fonts';

/**
 * The tab layout of the app's member tabs and the Staff section's tabs (the sage design, 18 November
 * 2026): a frosted white bar with one soft shadow, the chosen tab in deep sage on a pale pill
 * (tabIcon), quiet page-coloured headers with no rule, and the bar hidden while the keyboard is open.
 */
export function tabOptions(language: string) {
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderTopColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -2 },
      elevation: 8,
    },
    tabBarLabelStyle: { fontFamily: fontFamilyFor(language, 600) },
    tabBarHideOnKeyboard: true,
    headerStyle: { backgroundColor: colors.page },
    headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
    headerShadowVisible: false,
    sceneStyle: { backgroundColor: colors.page },
  };
}
