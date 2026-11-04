import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens';

type Props = {
  children: ReactNode;
  /** A 4 px navy rule on the left, for the one next step on Home. */
  accent?: boolean;
  /** Makes the whole card one pressable; it must then hold no other buttons. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** White card, 1 px border, 12 px radius and padding (spec §3, SurfaceCard). */
export function SurfaceCard({ children, accent = false, onPress, accessibilityLabel, style }: Props) {
  const cardStyle = [styles.card, accent && styles.accent, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[3],
    gap: spacing[2],
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  accent: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceVariant },
});
