import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, control, spacing } from '@my-people/design-tokens';

import { AppText } from './AppText';

type Props = { label: string; checked: boolean; onChange: (checked: boolean) => void };

export function Checkbox({ label, checked, onChange }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      aria-checked={checked}
      style={styles.row}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.primary : colors.controlBorder} />
      <AppText step="body" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], minHeight: control.touchMin, paddingVertical: spacing[2] },
  label: { flex: 1 },
});
