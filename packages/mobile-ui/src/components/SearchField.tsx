import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import { useTextScale } from '../display/DisplayPreferences';
import { scaledTextStyle } from '../fonts';
import { useLanguage } from '../hooks/useLanguage';

type Props = Omit<TextInputProps, 'style' | 'placeholder'> & {
  /** Shown inside the box and given to screen readers as the field's name. */
  label: string;
};

/** A search box with a magnifier and no label above it; the label is the placeholder and the accessible name. */
export function SearchField({ label, ...input }: Props) {
  const language = useLanguage();
  const body = scaledTextStyle(language, 'body', useTextScale());
  return (
    <View style={styles.box}>
      <Ionicons name="search-outline" size={20} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.textMuted}
        // 16 px or more, so phones do not zoom into the field.
        style={[body, styles.input, { fontSize: Math.max(16, body.fontSize) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: control.input,
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.card,
  },
  input: { flex: 1, paddingVertical: spacing[2], color: colors.text },
});
