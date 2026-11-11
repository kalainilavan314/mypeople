import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { colors } from '@my-people/design-tokens/mobile';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * A tab bar icon: the outline when the tab is not chosen; the filled icon on a soft round
 * highlight when it is. Pass the filled name; its "-outline" twin is used for the other state.
 */
export function tabIcon(name: IconName) {
  const outline = `${name}-outline` as IconName;
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar passes our design-token colours, which are strings. React
    // Native's ColorValue also allows numbers and null, which the icon does not.
    const tint = typeof color === 'string' ? color : undefined;
    return (
      <View style={[styles.slot, focused && styles.focused]}>
        <Ionicons name={focused ? name : outline} color={tint} size={size} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  slot: { width: 44, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  focused: { backgroundColor: colors.primaryContainer },
});
