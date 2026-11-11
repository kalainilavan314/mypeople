import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { colors, radius } from '@my-people/design-tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** A tab bar icon in the colour and size the tab bar asks for. */
export function tabIcon(name: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar passes our design-token colours, which are strings. React
    // Native's ColorValue also allows numbers and null, which the icon does not.
    const iconColor = focused ? colors.onBrandAccent : typeof color === 'string' ? color : undefined;
    return (
      <View style={[styles.icon, focused && styles.active]}>
        <Ionicons name={name} color={iconColor} size={size} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  icon: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.brandYellow, borderRadius: radius.pill },
});
