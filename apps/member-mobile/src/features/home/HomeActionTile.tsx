import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, IconTile } from '@my-people/mobile-ui';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import { FEATURE_ICONS, FEATURE_ROUTES } from './features';

type Feature = HomeView['quickActions'][number];

/**
 * A Home quick action in the sage design: a frosted tile with the function's outlined icon on a pale
 * sage square, the name, and one line of help (or why it is locked). Every tile looks the same, so
 * the icon and words carry the meaning rather than colour.
 */
export function HomeActionTile({ feature }: { feature: Feature }) {
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
      accessibilityLabel={`${label}. ${unavailableReason ?? description}`}
      aria-disabled={!opens}
      style={({ pressed }) => [
        styles.tile,
        stackCards && styles.stackedTile,
        !opens && styles.unavailable,
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <IconTile icon={feature.available ? (FEATURE_ICONS[feature.key] ?? 'ellipse-outline') : 'lock-closed-outline'} tint="brand" />
        {!opens ? (
          <Ionicons
            name="lock-closed-outline"
            size={iconSize.status}
            color={colors.textMuted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>

      <View style={styles.copy}>
        <AppText step="section" style={[styles.title, largeText && styles.largeTextTitle]}>
          {label}
        </AppText>
        <AppText
          step="secondary"
          tone="muted"
          style={[styles.description, largeText && styles.largeTextDescription]}
          numberOfLines={stackCards ? undefined : 3}>
          {unavailableReason ?? description}
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
    padding: spacing[4],
    gap: spacing[3],
    justifyContent: 'space-between',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  stackedTile: {
    flexBasis: '100%',
    width: '100%',
    minHeight: 0,
  },
  unavailable: { opacity: 0.78 },
  pressed: { backgroundColor: colors.surfaceVariant },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  copy: { gap: spacing[1] },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  largeTextTitle: { fontSize: 16, lineHeight: 24 },
  description: { fontSize: 14, lineHeight: 20 },
  largeTextDescription: { fontSize: 14, lineHeight: 21 },
});
