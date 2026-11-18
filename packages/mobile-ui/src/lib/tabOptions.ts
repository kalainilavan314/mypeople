import { colors } from '@my-people/design-tokens/mobile';
import { fontFamilyFor } from '../fonts';

/**
 * The tab layout of the app's member tabs and the Staff section's tabs (Puvi's production UI,
 * 12 November 2026): a white bar whose chosen tab shows in the brand colour, quiet page-coloured
 * headers with no rule, and the tab bar hidden while the keyboard is open.
 */
export function tabOptions(language: string) {
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
    tabBarLabelStyle: { fontFamily: fontFamilyFor(language, 600) },
    tabBarHideOnKeyboard: true,
    headerStyle: { backgroundColor: colors.page },
    headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
    headerShadowVisible: false,
    sceneStyle: { backgroundColor: colors.page },
  };
}
