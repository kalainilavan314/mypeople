import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

export type Tone = 'verified' | 'pending' | 'neutral' | 'error';

const TONES: Record<Tone, { icon: 'checkmark-circle' | 'time-outline' | 'ellipse-outline' | 'alert-circle'; text: 'success' | 'warning' | 'secondary' | 'error'; background: string; color: string }> = {
  verified: { icon: 'checkmark-circle', text: 'success', background: colors.successBackground, color: colors.successText },
  pending: { icon: 'time-outline', text: 'warning', background: colors.warningPill, color: colors.warningText },
  neutral: { icon: 'ellipse-outline', text: 'secondary', background: colors.surfaceVariant, color: colors.textSecondary },
  error: { icon: 'alert-circle', text: 'error', background: colors.errorBackground, color: colors.error },
};

/** A state shown with an icon and a label, never by colour alone (WCAG 1.4.1). */
export function StatusTag({ label, tone }: { label: string; tone: Tone }) {
  const style = TONES[tone];
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={[styles.tag, { backgroundColor: style.background }]}>
      <Ionicons name={style.icon} size={15} color={style.color} accessibilityElementsHidden importantForAccessibility="no" />
      <AppText step="secondary" tone={style.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radius.tag,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
  },
});
