import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens';

import { AppText } from './AppText';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  onPress: () => void;
  /** Draws the one separator above every row but the first. */
  first?: boolean;
};

/** A 48 px navigation row with an icon and a chevron (spec §8). */
export function MenuRow({ icon, label, hint, onPress, first = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, !first && styles.separator, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.text}>
        <AppText step="label">{label}</AppText>
        {hint ? (
          <AppText step="secondary" tone="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  text: { flex: 1 },
  pressed: { backgroundColor: colors.surfaceVariant },
});
