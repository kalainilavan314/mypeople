import Ionicons from '@expo/vector-icons/Ionicons';
import type { IssueVisibility } from '@my-people/api-client';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Notice } from '@my-people/mobile-ui';

type Props = { value: IssueVisibility; onChange: (value: IssueVisibility) => void };

const OPTIONS: { key: IssueVisibility; label: 'visibilityTeam' | 'visibilityPublic'; body: 'visibilityTeamBody' | 'visibilityPublicBody' }[] = [
  { key: 'team', label: 'visibilityTeam', body: 'visibilityTeamBody' },
  { key: 'public', label: 'visibilityPublic', body: 'visibilityPublicBody' },
];

/**
 * Team only (the default) or a public summary (FR-RPT-011). Choosing public says what the
 * summary leaves out and that it waits for moderation (FR-RPT-012).
 */
export function VisibilityChoice({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t('m.issues.visibility')}>
      {OPTIONS.map((option) => {
        const checked = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            aria-checked={checked}
            accessibilityLabel={`${t(`m.issues.${option.label}`)}. ${t(`m.issues.${option.body}`)}`}
            style={({ pressed }) => [styles.option, checked && styles.checked, pressed && styles.pressed]}>
            <Ionicons
              name={checked ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={checked ? colors.primary : colors.controlBorder}
            />
            <View style={styles.text}>
              <AppText step="card">{t(`m.issues.${option.label}`)}</AppText>
              <AppText step="secondary" tone="secondary">
                {t(`m.issues.${option.body}`)}
              </AppText>
            </View>
          </Pressable>
        );
      })}
      {value === 'public' ? <Notice tone="info">{t('m.issues.publicExplained')}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[2] },
  option: {
    minHeight: control.touchMin,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  checked: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryContainer },
  pressed: { backgroundColor: colors.surfaceVariant },
  text: { flex: 1, gap: 2 },
});
