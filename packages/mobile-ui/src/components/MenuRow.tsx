import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, tints, type Tint } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  /** Opens something; the row then shows a chevron. Leave it out for a row that holds its own control. */
  onPress?: () => void;
  /** A control at the row's end instead of the chevron, e.g. the language pill or a switch. */
  trailing?: ReactNode;
  /** Draws the one separator above every row but the first. */
  first?: boolean;
  /** The colour of the icon's tile. */
  tint?: Tint;
};

/** A settings or navigation row: the icon on a pale tile, the label, and a light chevron or a control. */
export function MenuRow({ icon, label, hint, onPress, trailing, first = false, tint = 'blue' }: Props) {
  const content = (
    <>
      <View style={[styles.tile, { backgroundColor: tints[tint].background }]}>
        <Ionicons name={icon} size={20} color={tints[tint].icon} />
      </View>
      <View style={styles.text}>
        <AppText step="card" weight={400}>{label}</AppText>
        {hint ? (
          <AppText step="secondary" tone="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.controlBorder} /> : null)}
    </>
  );
  if (!onPress) return <View style={[styles.row, !first && styles.separator]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, !first && styles.separator, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[3] },
  tile: { width: 38, height: 38, borderRadius: radius.input - 2, alignItems: 'center', justifyContent: 'center' },
  separator: { borderTopWidth: 1, borderTopColor: colors.divider },
  text: { flex: 1 },
  pressed: { backgroundColor: colors.surfaceVariant },
});
