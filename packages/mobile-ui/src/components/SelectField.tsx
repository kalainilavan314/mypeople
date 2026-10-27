import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import { useLanguage } from '../hooks/useLanguage';
import { stringsFor } from '../strings';

import { AppText } from './AppText';
import { TextField } from './TextField';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  error?: string | null;
};

/** A field that opens a searchable list, for the district, DS and GN lists. */
export function SelectField({ label, value, options, onChange, placeholder, disabled = false, error }: Props) {
  const text = stringsFor(useLanguage());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = options.find((option) => option.value === value);
  const shown = query ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <View style={styles.field}>
      <AppText step="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? placeholder}`}
        aria-disabled={disabled}
        style={[styles.box, disabled && styles.disabled, error ? styles.invalid : null]}>
        <AppText step="body" tone={chosen ? 'default' : 'muted'} style={styles.value}>
          {chosen?.label ?? placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <AppText step="secondary" tone="error" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <AppText step="section" accessibilityRole="header" style={styles.value}>
              {label}
            </AppText>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={text.close}
              style={styles.close}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {options.length > 8 ? (
            <TextField label={text.search} value={query} onChangeText={setQuery} autoCorrect={false} />
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={(option) => option.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setQuery('');
                  setOpen(false);
                }}
                accessibilityRole="button"
                aria-selected={item.value === value}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                <AppText step="body" style={styles.value}>
                  {item.label}
                </AppText>
                {item.value === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  box: {
    minHeight: control.height,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.control,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  disabled: { backgroundColor: colors.surfaceVariant },
  invalid: { borderColor: colors.error },
  value: { flex: 1 },
  sheet: { flex: 1, backgroundColor: colors.page, padding: spacing.gutter, gap: spacing[3] },
  sheetHeader: { flexDirection: 'row', alignItems: 'center' },
  close: { width: control.touchMin, height: control.touchMin, alignItems: 'center', justifyContent: 'center' },
  option: {
    minHeight: control.height,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing[2],
  },
  pressed: { backgroundColor: colors.surfaceVariant },
});
