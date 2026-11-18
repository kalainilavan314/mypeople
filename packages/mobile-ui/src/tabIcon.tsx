import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { colors, iconSize } from '@my-people/design-tokens/mobile';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * A tab bar icon in the colour the tab bar asks for. Every tab draws the same outlined icon at the
 * same size in the same fixed box; the chosen tab only gains a pale sage pill behind it, so nothing
 * moves or changes size when the tab changes (the sage design of 18 November 2026).
 */
export function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar passes our design-token colours, which are strings. React
    // Native's ColorValue also allows numbers and null, which the icon does not.
    const iconColor = typeof color === 'string' ? color : undefined;
    return (
      <View style={[styles.pill, focused && styles.chosen]}>
        <Ionicons name={name} color={iconColor} size={iconSize.tab} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  pill: { width: 48, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chosen: { backgroundColor: colors.brandYellow },
});
