import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, control, spacing } from '@my-people/design-tokens';
import { AppText, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/** Stable member navigation: account on the left, product in the centre, inbox on the right. */
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
          <Ionicons name="person" size={34} color={colors.primaryDark} />
        </Pressable>

        <View style={styles.brand} accessibilityRole="header">
          <Image
            source={require('../../assets/brand/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessible={false}
          />
          <AppText step="section" numberOfLines={1} style={styles.brandName}>
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
          <Ionicons name="notifications" size={34} color={colors.primaryDark} />
          {unread > 0 ? <View style={styles.unread} /> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.brandYellow,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  bar: {
    height: 64,
    paddingHorizontal: spacing.gutter,
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
  pressed: { backgroundColor: 'rgba(181, 18, 27, 0.08)' },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  brandLogo: { width: 38, height: 38 },
  brandName: { color: colors.primary },
  unread: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.brandYellow,
  },
});
