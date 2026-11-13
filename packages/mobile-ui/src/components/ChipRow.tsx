import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import { AppText } from './AppText';

type Option<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: readonly Option<K>[];
  /** Null when nothing is chosen yet, e.g. an event not answered. */
  selected: K | null;
  onSelect: (key: K) => void;
  label: string;
};

/** Filter chips that scroll sideways on their own; the chosen one uses the brand highlight. */
export function ChipRow<K extends string>({ options, selected, onSelect, label }: Props<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={label}
      accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="tab"
            aria-selected={active}
            style={[styles.chip, active ? styles.active : styles.inactive]}>
            <AppText step="label" tone={active ? 'brandAccent' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing[2] },
  chip: {
    minHeight: control.touchMin,
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.brandYellow, borderColor: colors.brandGold },
  inactive: { backgroundColor: colors.card, borderColor: colors.inputBorder },
});
