import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, tints, type Tint } from '@my-people/design-tokens/mobile';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  tint?: Tint;
  /** 48 for quick actions and notices, 40 for list rows. */
  size?: 40 | 48;
};

/** An icon on a pale rounded tile; decorative, so the text beside it carries the meaning. */
export function IconTile({ icon, tint = 'blue', size = 48 }: Props) {
  const colours = tints[tint];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, backgroundColor: colours.background }]}>
      <Ionicons name={icon} size={size === 48 ? 24 : 20} color={colours.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
});
