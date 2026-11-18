import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

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
      <View style={styles.corner} />
      <View style={styles.iconCircle}>
        <Ionicons
          name={FEATURE_ICONS[feature.key] ?? 'ellipse-outline'}
          size={34}
          color={colors.primaryDark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      {unavailableReason ? (
        <Ionicons
          name="lock-closed"
          size={17}
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
          tone="secondary"
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
    minHeight: 174,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing[4],
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  stackedTile: { flexBasis: '100%', width: '100%', minHeight: 150 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
    zIndex: 1,
  },
  lock: { position: 'absolute', right: spacing[3], top: spacing[3], zIndex: 2 },
  copy: { zIndex: 1, gap: 1 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: '700' },
  largeTextTitle: { fontSize: 18, lineHeight: 27 },
  description: { fontSize: 16, lineHeight: 22 },
  largeTextDescription: { fontSize: 14, lineHeight: 22 },
  corner: {
    position: 'absolute',
    width: 82,
    height: 62,
    right: -16,
    bottom: -18,
    borderTopLeftRadius: 70,
    backgroundColor: 'rgba(255, 211, 42, 0.42)',
  },
});
