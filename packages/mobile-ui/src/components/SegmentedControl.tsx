import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

type Option<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: readonly Option<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** Names the group for screen readers, e.g. "Show". */
  label: string;
};

/** Two or three equal tabs on a grey track; the chosen one is a white raised segment (All / Action needed). */
export function SegmentedControl<K extends string>({ options, selected, onSelect, label }: Props<K>) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            style={[styles.segment, active && styles.active]}>
            {/* Two lines rather than "…": Tamil labels are longer and must stay whole on narrow phones. */}
            <AppText step="label" weight={active ? 600 : 400} tone={active ? 'default' : 'secondary'} numberOfLines={2} style={styles.label}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.primaryContainer, borderRadius: radius.control, padding: spacing[1], gap: spacing[1] },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.control - 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[1], paddingVertical: spacing[1] },
  label: { textAlign: 'center' },
  active: {
    backgroundColor: colors.card,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
