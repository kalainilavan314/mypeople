import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, IconTile } from '@my-people/mobile-ui';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import { FEATURE_ICONS, FEATURE_ROUTES } from './features';

type Feature = HomeView['hub']['services'][number];

export function CommunityServiceTile({ feature }: { feature: Feature }) {
  const { t } = useTranslation();
  const { stackCards, largeText } = useResponsiveLayout();
  const route = FEATURE_ROUTES[feature.key];
  const label = t(`m.home.feature_${feature.key}`, { defaultValue: feature.key });
  const description = t(`m.home.feature_${feature.key}_description`, { defaultValue: '' });
  const unavailableReason = !feature.available
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
      accessibilityLabel={`${label}. ${description}${unavailableReason ? `. ${unavailableReason}` : ''}`}
      aria-disabled={!opens}
      style={({ pressed }) => [styles.tile, stackCards && styles.stackedTile, pressed && styles.pressed]}>
      <IconTile icon={FEATURE_ICONS[feature.key] ?? 'ellipse-outline'} tint="brand" />
      {unavailableReason ? (
        <Ionicons
          name="lock-closed-outline"
          size={iconSize.status}
          color={colors.textMuted}
          style={styles.lock}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <View style={styles.copy}>
        <AppText step="section" style={[styles.title, largeText && styles.largeTextTitle]}>
          {label}
        </AppText>
        <AppText
          step="secondary"
          tone="muted"
          style={[styles.description, largeText && styles.largeTextDescription]}
          numberOfLines={stackCards ? undefined : 3}>
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    minHeight: 160,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing[4],
    gap: spacing[3],
    justifyContent: 'space-between',
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  stackedTile: { flexBasis: '100%', width: '100%', minHeight: 0 },
  pressed: { backgroundColor: colors.surfaceVariant },
  lock: { position: 'absolute', right: spacing[4], top: spacing[4] },
  copy: { gap: spacing[1] },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  largeTextTitle: { fontSize: 16, lineHeight: 24 },
  description: { fontSize: 14, lineHeight: 20 },
  largeTextDescription: { fontSize: 14, lineHeight: 21 },
});
