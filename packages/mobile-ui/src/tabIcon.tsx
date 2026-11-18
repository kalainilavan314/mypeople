import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

import { comfortableTypeScale, tamilComfortableTypeScale } from '@my-people/design-tokens/mobile';

import { fontFamilyFor } from './fonts';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * A tab bar icon in the colour the tab bar asks for: the chosen tab in charcoal, the others in grey.
 * Every tab keeps the same outlined icon whether chosen or not, so the bar reads as one icon family;
 * the colour and the label's weight show which tab is open.
 */
export function tabIcon(name: IconName, size = 24) {
  return function TabIcon({ color }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar passes our design-token colours, which are strings. React
    // Native's ColorValue also allows numbers and null, which the icon does not.
    const iconColor = typeof color === 'string' ? color : undefined;
    return (
      <View style={styles.icon}>
        <Ionicons name={name} color={iconColor} size={size} />
      </View>
    );
  };
}

/**
 * The label under a tab icon. The tab bar pads each tab by 5 px on both sides, which on a 320 px
 * phone leaves the longest Tamil label (நிகழ்வுகள்) 3 px short, so the label may use that padding,
 * and on phones it shrinks a little rather than end in "…".
 */
export function tabLabel(language: string) {
  const nav = language === 'ta' ? tamilComfortableTypeScale.nav : comfortableTypeScale.nav;
  return function TabLabel({ color, focused, children }: { color: ColorValue; focused: boolean; children: string }) {
    return (
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[
          styles.label,
          {
            color: typeof color === 'string' ? color : undefined,
            fontFamily: fontFamilyFor(language, focused ? 700 : 500),
            fontSize: nav.size,
            lineHeight: nav.lineHeight,
          },
        ]}>
        {children}
      </Text>
    );
  };
}

const styles = StyleSheet.create({
  icon: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  // React Native Web caps one-line text at the container's width (max-width: 100%); the label may use the padding.
  label: { alignSelf: 'stretch', maxWidth: '112%', textAlign: 'center', marginHorizontal: -4 },
});
