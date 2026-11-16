import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, control, spacing } from '@my-people/design-tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Checkbox({ label, checked, onChange, disabled = false, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      aria-disabled={disabled}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={[styles.row, disabled && styles.disabled]}>
      <Ionicons accessible={false} name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.primary : colors.controlBorder} />
      <AppText step="body" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: control.height,
    minWidth: control.touchMin,
    paddingVertical: spacing[2],
  },
  label: { flex: 1 },
  disabled: { opacity: 0.5 },
});
