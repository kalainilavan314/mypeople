import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, control, iconSize, iconTile, spacing } from '@my-people/design-tokens/mobile';
import { AppText, fontFamilyFor, useApiQuery, useLanguage, useReloadOnFocus } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { useFeatureEnabled } from '@/lib/useFeatureEnabled';

/**
 * Stable member navigation: account on the left, product in the centre, inbox on the right. The AI
 * assistant's button sits beside the inbox only while its module is on (M28; no sixth tab).
 */
export function MemberTopBar() {
  const { t } = useTranslation();
  const language = useLanguage();
  // "TMK" over the Tamil party name, as the design's two-line brand; it fits at 320 px in both languages.
  const shortName = language === 'ta' ? t('m.welcome.titleOther') : t('m.welcome.title');
  const tamilName = language === 'ta' ? t('m.welcome.title') : t('m.welcome.titleOther');
  const inbox = useApiQuery(() => api().getNotifications({ limit: 1 }));
  useReloadOnFocus(inbox.reload);
  const unread = inbox.data?.unread ?? 0;
  const assistantOn = useFeatureEnabled('ai_assistant');

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={t('nav.profile')}
          hitSlop={4}
          style={styles.action}>
          {({ pressed }) => (
            <View style={[styles.circle, pressed && styles.pressed]}>
              <Ionicons name="person-outline" size={iconSize.header} color={colors.primaryDark} />
            </View>
          )}
        </Pressable>

        <View style={styles.brand} accessibilityRole="header">
          <Image
            source={require('../../assets/brand/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.brandText}>
            <AppText step="section" numberOfLines={1} style={styles.brandName}>
              {shortName}
            </AppText>
            <AppText
              step="caption"
              tone="muted"
              numberOfLines={1}
              style={[styles.brandTamil, { fontFamily: fontFamilyFor('ta', 500) }]}>
              {tamilName}
            </AppText>
          </View>
        </View>

        {assistantOn ? (
          <Pressable
            onPress={() => router.push('/assistant')}
            accessibilityRole="button"
            accessibilityLabel={t('m.assistant.open')}
            hitSlop={4}
            style={styles.action}>
            {({ pressed }) => (
              <View style={[styles.circle, pressed && styles.pressed]}>
                <Ionicons name="sparkles-outline" size={iconSize.header} color={colors.primaryDark} />
              </View>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0
              ? `${t('m.home.notifications')}, ${t('m.home.unread', { count: unread })}`
              : t('m.home.notifications')
          }
          hitSlop={4}
          style={styles.action}>
          {({ pressed }) => (
            <View style={[styles.circle, pressed && styles.pressed]}>
              <Ionicons name="notifications-outline" size={iconSize.header} color={colors.primaryDark} />
              {unread > 0 ? <View style={styles.unread} /> : null}
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  bar: {
    height: 60,
    paddingHorizontal: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A 44 px touch target holding the design's 40 px frosted circle.
  action: { width: control.touchMin, height: control.touchMin, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  circle: {
    width: iconTile.header,
    height: iconTile.header,
    borderRadius: iconTile.header / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceVariant },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  brandLogo: { width: 32, height: 32 },
  brandText: { flexShrink: 1, minWidth: 0 },
  brandName: { color: colors.text, fontSize: 16, lineHeight: 20 },
  brandTamil: { fontSize: 11, lineHeight: 16 },
  unread: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.card,
  },
});
