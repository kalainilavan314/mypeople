import { colors, typeScale } from '@my-people/design-tokens/mobile';
import { fontFamilyFor } from '../fonts';

/**
 * The tab layout of both apps: a white bar whose chosen tab is navy on a soft highlight (see
 * tabIcon), and tab pages titled in large regular type on the page colour, aligned left.
 */
export function tabOptions(language: string) {
  const tamil = language === 'ta';
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.divider },
    tabBarItemStyle: { paddingTop: 4 },
    tabBarLabelStyle: { fontFamily: fontFamilyFor(language, 400), fontSize: tamil ? 10 : typeScale.nav.size },
    headerStyle: { backgroundColor: colors.page },
    headerShadowVisible: false,
    headerTitleAlign: 'left' as const,
    headerTitleStyle: {
      fontFamily: fontFamilyFor(language, typeScale.page.weight),
      fontSize: tamil ? 22 : typeScale.page.size,
      color: colors.text,
    },
    sceneStyle: { backgroundColor: colors.page },
  };
}
