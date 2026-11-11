import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Keeps the label and adds a spinner; the button stays the same width (spec §3). */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** The icon after the label, as on "Join the Community →". */
  iconAfter?: boolean;
  accessibilityHint?: string;
};

const FILL: Record<Variant, { background: string; pressed: string; text: 'inverse' | 'default' | 'primary' | 'error'; border: string }> = {
  primary: { background: colors.primary, pressed: colors.primaryDark, text: 'inverse', border: colors.primary },
  secondary: { background: colors.card, pressed: colors.surfaceVariant, text: 'default', border: colors.border },
  quiet: { background: 'transparent', pressed: colors.surfaceVariant, text: 'primary', border: 'transparent' },
  danger: { background: colors.card, pressed: colors.errorBackground, text: 'error', border: colors.errorBorder },
};

const ICON_COLOR = { inverse: colors.onPrimary, default: colors.text, primary: colors.primary, error: colors.error } as const;

/** A full-width button with a 56 px target and 14 px corners. */
export function Button({ label, onPress, variant = 'primary', busy = false, busyLabel, disabled = false, icon, iconAfter = false, accessibilityHint }: Props) {
  const fill = FILL[variant];
  const inactive = disabled || busy;
  const iconColor = ICON_COLOR[fill.text];
  const accessibleName = busy && busyLabel ? busyLabel : label;
  const glyph = busy ? <ActivityIndicator size="small" color={iconColor} /> : icon ? <Ionicons name={icon} size={20} color={iconColor} /> : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibleName}
      accessibilityState={{ disabled: inactive, busy }}
      aria-disabled={inactive}
      aria-busy={busy}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? fill.pressed : fill.background, borderColor: fill.border },
        disabled && styles.disabled,
      ]}>
      <View accessible={false} style={styles.inner}>
        {iconAfter ? null : glyph}
        <AppText step="card" tone={fill.text} weight={fill.text === 'inverse' ? 500 : 400} style={styles.label}>
          {accessibleName}
        </AppText>
        {iconAfter ? glyph : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: control.height,
    minWidth: control.touchMin,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  label: { textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.45 },
});
