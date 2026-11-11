import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText, IconTile } from '@my-people/mobile-ui';

import { FEATURE_ICONS, FEATURE_ROUTES, FEATURE_TINTS } from './features';

type Feature = HomeView['quickActions'][number];

/**
 * A quick action or hub service: a tinted icon above its name. Locked ones show the padlock and the
 * reason (FR-HOME-008); ones not built yet say so; only working ones open.
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
      <View style={styles.top}>
        <IconTile icon={FEATURE_ICONS[feature.key] ?? 'ellipse-outline'} tint={opens ? FEATURE_TINTS[feature.key] ?? 'blue' : 'navy'} />
        {feature.available ? null : <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />}
      </View>
      <View style={styles.text}>
        <AppText step="card" weight={400} tone={opens ? 'default' : 'muted'}>
          {label}
        </AppText>
        {caption ? (
          <AppText step="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 124,
    justifyContent: 'space-between',
    gap: spacing[4],
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[4],
  },
  pressed: { backgroundColor: colors.surfaceVariant },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  text: { gap: 2 },
});
