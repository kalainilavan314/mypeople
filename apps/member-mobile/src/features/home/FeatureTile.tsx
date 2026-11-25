import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import { FEATURE_ICONS, FEATURE_PHOTOS, FEATURE_ROUTES } from './features';

type Feature = HomeView['quickActions'][number];

/**
 * A service button as the owner's design (25 November 2026): the service's photo with rounded
 * corners and a white bar along its bottom holding the outlined icon, the name and an arrow. The
 * photos are small bundled WebP files (880 × 440), so the buttons never wait on the network. A
 * locked service shows a lock and the reason instead of the arrow.
 */
export function FeatureTile({ feature }: { feature: Feature }) {
  const { t } = useTranslation();
  const { largeText } = useResponsiveLayout();
  const route = FEATURE_ROUTES[feature.key];
  const photo = FEATURE_PHOTOS[feature.key];
  const label = t(`m.home.feature_${feature.key}`, { defaultValue: feature.key });
  const unavailableReason = !feature.available
    ? t(`m.home.reason_${feature.reason}`, { defaultValue: t('m.home.locked') })
    : route
      ? null
      : t('m.common.notBuilt');
  const opens = feature.available && route !== undefined;
  const icon = FEATURE_ICONS[feature.key] ?? 'ellipse-outline';

  return (
    <Pressable
      onPress={() => route && router.push(route)}
      disabled={!opens}
      accessibilityRole={opens ? 'link' : 'text'}
      accessibilityLabel={[label, unavailableReason].filter(Boolean).join('. ')}
      aria-disabled={!opens}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {photo ? (
        <Image source={photo} style={[styles.photo, !opens && styles.lockedPhoto]} resizeMode="cover" accessible={false} />
      ) : (
        <View style={styles.noPhoto}>
          <Ionicons name={icon} size={72} color={colors.primary} style={styles.noPhotoIcon} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
      )}

      <View style={styles.bar}>
        <Ionicons
          name={opens ? icon : 'lock-closed-outline'}
          size={28}
          color={colors.text}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={styles.copy}>
          <AppText step="section" style={[styles.label, largeText && styles.largeTextLabel]} numberOfLines={2}>
            {label}
          </AppText>
          {unavailableReason ? (
            <AppText step="caption" tone="muted" numberOfLines={2}>
              {unavailableReason}
            </AppText>
          ) : null}
        </View>
        {opens ? (
          <Ionicons
            name="chevron-forward"
            size={24}
            color={colors.text}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full width on a phone; two side by side once there is room for 280 px each.
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 280,
    aspectRatio: 2,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing[3],
    backgroundColor: colors.surfaceVariant,
  },
  pressed: { opacity: 0.88 },
  photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  lockedPhoto: { opacity: 0.5 },
  noPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: spacing[4] },
  noPhotoIcon: { opacity: 0.35 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 60,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.card,
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  largeTextLabel: { fontSize: 18, lineHeight: 25 },
});
