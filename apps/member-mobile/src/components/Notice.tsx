import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens';

import { AppText } from './AppText';

type Tone = 'info' | 'warning' | 'error' | 'success';

const TONES = {
  info: { icon: 'information-circle-outline', background: colors.surfaceVariant, border: colors.border, color: colors.primary, text: 'default' },
  warning: { icon: 'time-outline', background: colors.warningBackground, border: colors.warning, color: colors.warningText, text: 'warning' },
  error: { icon: 'alert-circle-outline', background: colors.errorBackground, border: colors.error, color: colors.error, text: 'error' },
  success: { icon: 'checkmark-circle-outline', background: colors.successBackground, border: colors.success, color: colors.successText, text: 'success' },
} as const;

type Props = { tone?: Tone; title?: string; children?: ReactNode };

/** A message box with an icon; errors are announced as alerts. */
export function Notice({ tone = 'info', title, children }: Props) {
  const style = TONES[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: style.background, borderColor: style.border }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'info' ? undefined : 'polite'}>
      <Ionicons name={style.icon} size={20} color={style.color} />
      <View style={styles.text}>
        {title ? (
          <AppText step="label" tone={style.text}>
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? (
          <AppText step="secondary" tone={style.text === 'default' ? 'secondary' : style.text}>
            {children}
          </AppText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing[3], padding: spacing[3], borderWidth: 1, borderRadius: radius.card },
  text: { flex: 1, gap: spacing[1] },
});
