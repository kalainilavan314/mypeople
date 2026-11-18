import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@my-people/mobile-ui';

import { fundColors } from './fundStyle';

/** The fund screens' main action: a full-width near-black pill. */
export function PillButton({ label, onPress, busy = false, disabled = false }: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const inactive = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, disabled && styles.disabled]}>
      {busy ? <ActivityIndicator color={fundColors.onInk} /> : null}
      <AppText step="card" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: fundColors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  pressed: { backgroundColor: fundColors.inkSoft },
  disabled: { opacity: 0.45 },
  label: { color: fundColors.onInk, textAlign: 'center' },
});
