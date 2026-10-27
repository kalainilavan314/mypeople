import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';

import { AppText } from '@my-people/mobile-ui';

import { FEATURE_ICONS, FEATURE_ROUTES } from './features';

type Feature = HomeView['quickActions'][number];

/**
 * A quick action or hub service. Locked ones show the padlock and the reason
 * (FR-HOME-008); ones not built yet say so; only working ones open.
 */
export function FeatureTile({ feature }: { feature: Feature }) {
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
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.well}>
        <Ionicons
          name={feature.available ? (FEATURE_ICONS[feature.key] ?? 'ellipse-outline') : 'lock-closed-outline'}
          size={20}
          color={feature.available ? colors.primary : colors.textMuted}
        />
      </View>
      <AppText step="label" tone={opens ? 'default' : 'muted'}>
        {label}
      </AppText>
      {caption ? (
        <AppText step="caption" tone="muted">
          {caption}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[3],
    gap: spacing[1],
  },
  pressed: { backgroundColor: colors.surfaceVariant },
  well: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
