import { StyleSheet } from 'react-native';

import { colors, comfortableTypeScale, tamilComfortableTypeScale } from '@my-people/design-tokens/mobile';
import { fontFamilyFor } from '../fonts';
import { tabLabel } from '../tabIcon';

/**
 * The tab bars of the member tabs and the Staff section (the owner's monochrome design, 18 November
 * 2026): a white bar with one hairline above, the chosen tab in charcoal and the others in grey,
 * equal widths, and the bar hidden while the keyboard is open.
 */
export function tabOptions(language: string) {
  const nav = language === 'ta' ? tamilComfortableTypeScale.nav : comfortableTypeScale.nav;
  return {
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.iconInactive,
    tabBarStyle: {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarLabelStyle: { fontFamily: fontFamilyFor(language, 600), fontSize: nav.size, lineHeight: nav.lineHeight },
    tabBarLabel: tabLabel(language),
    tabBarItemStyle: { minHeight: 48 },
    tabBarHideOnKeyboard: true,
    headerStyle: { backgroundColor: colors.card },
    headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
    headerShadowVisible: false,
    sceneStyle: { backgroundColor: colors.page },
  };
}
