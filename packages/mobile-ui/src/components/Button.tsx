import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

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
  accessibilityHint?: string;
};

const FILL: Record<Variant, { background: string; pressed: string; text: 'inverse' | 'primary' | 'error'; border: string }> = {
  primary: { background: colors.primary, pressed: colors.primaryDark, text: 'inverse', border: colors.primary },
  secondary: { background: colors.card, pressed: colors.surfaceVariant, text: 'primary', border: colors.inputBorder },
  quiet: { background: 'transparent', pressed: colors.surfaceVariant, text: 'primary', border: 'transparent' },
  danger: { background: colors.card, pressed: colors.errorBackground, text: 'error', border: colors.error },
};

/** A real button with a 48 px target (PrimaryAction in the spec). */
export function Button({ label, onPress, variant = 'primary', busy = false, busyLabel, disabled = false, icon, accessibilityHint }: Props) {
  const fill = FILL[variant];
  const inactive = disabled || busy;
  const textColor = fill.text === 'inverse' ? colors.onPrimary : fill.text === 'error' ? colors.error : colors.primary;
  const accessibleName = busy && busyLabel ? busyLabel : label;

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
        {busy ? <ActivityIndicator size="small" color={textColor} /> : icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
        <AppText step="label" tone={fill.text} style={styles.label}>
          {accessibleName}
        </AppText>
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
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  label: { textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.5 },
});
