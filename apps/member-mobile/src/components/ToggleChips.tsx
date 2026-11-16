import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

type Option<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: readonly Option<K>[];
  selected: readonly K[];
  onChange: (selected: K[]) => void;
  /** Names the group for screen readers, e.g. "Skills". */
  label: string;
  disabled?: boolean;
};

/** Chips where any number can be chosen; each is a checkbox with a tick, never colour alone. */
export function ToggleChips<K extends string>({ options, selected, onChange, label, disabled = false }: Props<K>) {
  const toggle = (key: K) =>
    onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  return (
    <View style={styles.row} accessibilityLabel={label}>
      {options.map((option) => {
        const checked = selected.includes(option.key);
        return (
          <Pressable
            key={option.key}
            onPress={() => toggle(option.key)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityState={{ checked, disabled }}
            aria-checked={checked}
            style={[styles.chip, checked ? styles.active : styles.inactive, disabled && styles.disabled]}>
            {checked ? <Ionicons name="checkmark" size={16} color={colors.onBrandAccent} /> : null}
            <AppText step="label" tone={checked ? 'brandAccent' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    minHeight: control.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  active: { backgroundColor: colors.brandYellow, borderColor: colors.brandGold },
  inactive: { backgroundColor: colors.card, borderColor: colors.inputBorder },
  disabled: { opacity: 0.5 },
});
