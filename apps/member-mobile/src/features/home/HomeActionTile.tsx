import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';
import { AppText } from '@my-people/mobile-ui';

import { FEATURE_ICONS, FEATURE_ROUTES } from './features';

type Feature = HomeView['quickActions'][number];

const BACKGROUND_ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  report_issue: 'megaphone',
  volunteer: 'people',
  my_area: 'location',
  community: 'people',
};

export function HomeActionTile({ feature, tone }: { feature: Feature; tone: 'red' | 'yellow' }) {
  const { t } = useTranslation();
  const route = FEATURE_ROUTES[feature.key];
  const label = t(`m.home.feature_${feature.key}`, { defaultValue: feature.key });
  const description = t(`m.home.feature_${feature.key}_description`, { defaultValue: '' });
  const unavailableReason = !feature.available
    ? t(`m.home.reason_${feature.reason}`, { defaultValue: t('m.home.locked') })
    : route
      ? null
      : t('m.common.notBuilt');
  const opens = feature.available && route !== undefined;
  const foreground = tone === 'red' ? colors.onPrimary : colors.primaryDark;

  return (
    <Pressable
      onPress={() => route && router.push(route)}
      disabled={!opens}
      accessibilityRole={opens ? 'link' : 'text'}
      accessibilityLabel={`${label}. ${unavailableReason ?? description}`}
      aria-disabled={!opens}
      style={({ pressed }) => [
        styles.tile,
        tone === 'red' ? styles.red : styles.yellow,
        !opens && styles.unavailable,
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={BACKGROUND_ICONS[feature.key] ?? FEATURE_ICONS[feature.key] ?? 'ellipse'}
        size={104}
        color={foreground}
        style={styles.backgroundIcon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.topRow}>
        <Ionicons
          name={feature.available ? (FEATURE_ICONS[feature.key] ?? 'ellipse-outline') : 'lock-closed-outline'}
          size={50}
          color={foreground}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        {!opens ? (
          <Ionicons
            name="lock-closed"
            size={18}
            color={foreground}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>

      <View style={styles.copy}>
        <AppText step="section" style={[styles.title, { color: foreground }]}>
          {label}
        </AppText>
        <AppText step="secondary" style={[styles.description, { color: foreground }]} numberOfLines={3}>
          {unavailableReason ?? description}
        </AppText>
      </View>

      {opens ? (
        <View style={[styles.arrow, tone === 'red' ? styles.arrowOnRed : styles.arrowOnYellow]}>
          <Ionicons
            name="chevron-forward"
            size={25}
            color={foreground}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    minHeight: 190,
    borderRadius: radius.card,
    padding: spacing[4],
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  red: { backgroundColor: colors.primary },
  yellow: { backgroundColor: colors.brandYellow },
  unavailable: { opacity: 0.72 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  backgroundIcon: { position: 'absolute', right: 8, top: 48, opacity: 0.1 },
  topRow: { zIndex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  copy: { zIndex: 1, gap: spacing[1], paddingRight: spacing[4] },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '700' },
  description: { fontSize: 16, lineHeight: 23, fontWeight: '500' },
  arrow: {
    zIndex: 1,
    position: 'absolute',
    right: spacing[3],
    bottom: spacing[3],
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOnRed: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  arrowOnYellow: { backgroundColor: 'rgba(181, 18, 27, 0.10)' },
});
