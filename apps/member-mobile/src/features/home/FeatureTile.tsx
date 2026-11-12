import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from '@my-people/mobile-ui';

import { FEATURE_ICONS, FEATURE_ROUTES } from './features';

type Feature = HomeView['quickActions'][number];

/**
 * A quick action or hub service. Locked ones show the padlock and the reason
 * (FR-HOME-008); ones not built yet say so; only working ones open.
 */
export function FeatureTile({ feature, divided = false }: { feature: Feature; divided?: boolean }) {
  const { t } = useTranslation();
  const route = FEATURE_ROUTES[feature.key];
  const label = t(`m.home.feature_${feature.key}`, { defaultValue: feature.key });
  const caption = !feature.available
    ? t(`m.home.reason_${feature.reason}`, { defaultValue: t('m.home.locked') })
    : route
      ? null
      : t('m.common.notBuilt');
  const opens = feature.available && route !== undefined;

  return (
    <Pressable
      onPress={() => route && router.push(route)}
      disabled={!opens}
      accessibilityRole={opens ? 'link' : 'text'}
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      aria-disabled={!opens}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}>
      <Ionicons
        name={feature.available ? (FEATURE_ICONS[feature.key] ?? 'ellipse-outline') : 'lock-closed-outline'}
        size={20}
        color={opens ? colors.textSecondary : colors.textMuted}
      />
      <View style={styles.copy}>
        <AppText step="label" tone={opens ? 'default' : 'muted'}>
          {label}
        </AppText>
        {caption ? (
          <AppText step="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
      {opens ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: control.touchMin + spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { backgroundColor: colors.surfaceVariant },
  copy: { flex: 1, gap: 2 },
});
