import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

type Language = 'ta' | 'en';

const OPTIONS: { key: Language; label: string }[] = [
  { key: 'ta', label: 'தமிழ்' },
  { key: 'en', label: 'English' },
];

type Props = {
  value: string;
  onChange: (language: Language) => void;
  /** "Language" in the current language, for screen readers. */
  label: string;
};

/**
 * The small "தமிழ் | English" pill: the chosen language on navy, the other in link blue. Each name is
 * written in its own script so a reader of either language finds it. Visually 36 px tall; the touch area
 * reaches 44 px.
 */
export function LanguageToggle({ value, onChange, label }: Props) {
  return (
    <View style={styles.pill} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {OPTIONS.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: active }}
            aria-checked={active}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            style={[styles.option, active && styles.active]}>
            <AppText step="secondary" tone={active ? 'inverse' : 'link'} style={option.key === 'ta' ? styles.tamil : null}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#d8e2f3',
    backgroundColor: '#eef3fc',
  },
  option: { minHeight: 30, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center' },
  active: { backgroundColor: colors.primary },
  // The Tamil name sits in Noto Sans Tamil even when the app is in English.
  tamil: { fontFamily: 'NotoSansTamil_400Regular' },
});
