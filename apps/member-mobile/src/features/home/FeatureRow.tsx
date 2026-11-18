import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, IconTile } from '@my-people/mobile-ui';

import { FEATURE_ICONS, FEATURE_ROUTES } from './features';

type Feature = HomeView['quickActions'][number];

/**
 * One Home quick action or Community hub service, as a row in a list card: the icon on a quiet tile,
 * the name and a short description, and a chevron. A service the member cannot open yet shows a lock
 * and says why instead, and does not open anything.
 */
export function FeatureRow({ feature, first = false }: { feature: Feature; first?: boolean }) {
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

  return (
    <Pressable
      onPress={() => route && router.push(route)}
      disabled={!opens}
      accessibilityRole={opens ? 'link' : 'text'}
      accessibilityLabel={`${label}. ${unavailableReason ?? description}`}
      aria-disabled={!opens}
      style={({ pressed }) => [styles.row, !first && styles.separator, pressed && opens && styles.pressed]}>
      <IconTile icon={FEATURE_ICONS[feature.key] ?? 'ellipse-outline'} size={40} />
      <View style={styles.text}>
        <AppText step="card">{label}</AppText>
        {unavailableReason || description ? (
          <AppText step="secondary" tone="muted">
            {unavailableReason ?? description}
          </AppText>
        ) : null}
      </View>
      <Ionicons
        name={opens ? 'chevron-forward' : 'lock-closed-outline'}
        size={18}
        color={colors.controlBorder}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  separator: { borderTopWidth: 1, borderTopColor: colors.divider },
  text: { flex: 1, gap: 2 },
  pressed: { backgroundColor: colors.surfaceVariant },
});
