import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** A tab bar icon in the colour and size the tab bar asks for. */
export function tabIcon(name: IconName, fixedSize?: number) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar passes our design-token colours, which are strings. React
    // Native's ColorValue also allows numbers and null, which the icon does not.
    const iconColor = typeof color === 'string' ? color : undefined;
    return (
      <View style={styles.icon}>
        <Ionicons name={name} color={iconColor} size={fixedSize ?? size} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  icon: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
});
