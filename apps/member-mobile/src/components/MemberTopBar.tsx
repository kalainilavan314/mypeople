import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, control, spacing } from '@my-people/design-tokens/mobile';
import { AppText, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * The app bar of the four main tabs: profile on the left, the logo and name in the centre, the inbox
 * on the right, on white with one hairline below. The brand stays centred whatever the two sides hold,
 * because both side controls have the same width.
 */
export function MemberTopBar() {
  const { t } = useTranslation();
  const inbox = useApiQuery(() => api().getNotifications({ limit: 1 }));
  useReloadOnFocus(inbox.reload);
  const unread = inbox.data?.unread ?? 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={t('nav.profile')}
          hitSlop={4}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Ionicons name="person-circle-outline" size={28} color={colors.text} />
        </Pressable>

        <View style={styles.brand} accessibilityRole="header">
          <Image
            source={require('../../assets/brand/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessible={false}
          />
          <AppText step="card" weight={700} numberOfLines={1} style={styles.brandName}>
            {t('m.welcome.title')}
          </AppText>
        </View>

        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0
              ? `${t('m.home.notifications')}, ${t('m.home.unread', { count: unread })}`
              : t('m.home.notifications')
          }
          hitSlop={4}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
          {unread > 0 ? <View style={styles.unread} /> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: {
    height: 56,
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    width: control.touchMin,
    height: control.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: control.touchMin / 2,
  },
  pressed: { backgroundColor: colors.surfaceVariant },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  brandLogo: { width: 28, height: 28 },
  brandName: { color: colors.text, flexShrink: 1 },
  unread: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.card,
  },
});
