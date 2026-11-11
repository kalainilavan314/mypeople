import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing, type Tint } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';
import { IconTile } from './IconTile';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  tint: Tint;
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
};

/** A quick-action tile for a two-column grid: a tinted icon above its label. */
export function ActionTile({ icon, tint, label, onPress, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <IconTile icon={icon} tint={tint} />
      <AppText step="card" weight={400}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 124,
    justifyContent: 'space-between',
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.surfaceVariant },
});
