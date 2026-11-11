import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

type Tone = 'info' | 'warning' | 'error' | 'success';

const TONES = {
  info: { icon: 'information-circle-outline', background: colors.card, border: colors.border, color: colors.link, text: 'default' },
  warning: { icon: 'information-circle-outline', background: colors.warningBackground, border: colors.warningBorder, color: colors.warningText, text: 'warning' },
  error: { icon: 'alert-circle-outline', background: colors.errorBackground, border: colors.errorBorder, color: colors.error, text: 'error' },
  success: { icon: 'checkmark-circle-outline', background: colors.successBackground, border: colors.successBackground, color: colors.successText, text: 'success' },
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
          <AppText step="card" tone="default">
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
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[4], borderWidth: 1, borderRadius: radius.card },
  text: { flex: 1, gap: spacing[1] },
});
