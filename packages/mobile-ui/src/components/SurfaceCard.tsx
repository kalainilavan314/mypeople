import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';

type Props = {
  children: ReactNode;
  /** A 4 px navy rule on the left, for the one next step on Home. */
  accent?: boolean;
  /** Makes the whole card one pressable; it must then hold no other buttons. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** White card with a fine border, 16 px corners and padding. */
export function SurfaceCard({ children, accent = false, onPress, accessibilityLabel, accessibilityHint, style }: Props) {
  const cardStyle = [styles.card, accent && styles.accent, style];
  // Non-interactive cards must NOT have accessible={true}, so child elements remain directly accessible.
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: control.height,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[4],
    gap: spacing[2],
    shadowColor: colors.primary,
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  accent: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceVariant },
});
