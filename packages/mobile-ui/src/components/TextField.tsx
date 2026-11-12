import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import { useTextScale } from '../display/DisplayPreferences';
import { scaledTextStyle } from '../fonts';

import { useLanguage } from '../hooks/useLanguage';
import { stringsFor } from '../strings';

import { AppText } from './AppText';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  hint?: string;
  error?: string | null;
  /** A password field, with a show/hide control. */
  secret?: boolean;
  optional?: boolean;
};

/** A labelled input; the error sits under it and is announced (spec §9). */
export function TextField({ label, hint, error, secret = false, optional = false, multiline, ...input }: Props) {
  const language = useLanguage();
  const body = scaledTextStyle(language, 'body', useTextScale());
  const text = stringsFor(language);
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const isInvalid = Boolean(error);
  const isDisabled = input.editable === false;

  return (
    <View style={styles.field}>
      <AppText step="body" tone="secondary">
        {label}
        {optional ? <AppText step="secondary" tone="muted">{`  ${text.optional}`}</AppText> : null}
      </AppText>
      {hint ? (
        <AppText step="secondary" tone="muted">
          {hint}
        </AppText>
      ) : null}
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          focused && styles.focused,
          isInvalid ? styles.invalid : null,
        ]}>
        <TextInput
          {...input}
          multiline={multiline}
          accessible
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ disabled: isDisabled }}
          aria-disabled={isDisabled}
          aria-invalid={isInvalid}
          aria-required={!optional}
          secureTextEntry={secret && hidden}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          placeholderTextColor={colors.textMuted}
          // 16 px or more, so phones do not zoom into the field.
          style={[body, styles.input, { fontSize: Math.max(16, body.fontSize) }]}
        />
        {secret ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={hidden ? text.showPassword : text.hidePassword}
            accessibilityState={{ checked: !hidden }}
            aria-label={hidden ? text.showPassword : text.hidePassword}
            hitSlop={8}
            style={styles.reveal}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText step="secondary" tone="error" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: control.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    backgroundColor: colors.card,
  },
  multiline: { minHeight: 112, alignItems: 'flex-start' },
  focused: { borderColor: colors.focusRing, borderWidth: 2 },
  invalid: { borderColor: colors.error },
  input: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    color: colors.text,
    // The box around the input already shows focus (focusRing, 2 px). Without this the web build
    // also draws the browser's own focus ring inside it: two borders. Chrome draws its 'auto' ring
    // at any outline width, so the style itself must be none; React Native's types only list the
    // native styles, hence the cast, which applies to the web build alone.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  reveal: { width: control.input, height: control.input, alignItems: 'center', justifyContent: 'center' },
});
