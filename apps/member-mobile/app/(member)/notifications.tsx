import type { NotificationItem } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { colors, spacing, type Tint } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  formatDateTime,
  IconTile,
  Screen,
  SegmentedControl,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

type View_ = 'all' | 'action_needed';

/** The icon and tile colour of each kind of notice, as in the reference recording. */
const KIND: Record<string, { icon: ComponentProps<typeof Ionicons>['name']; tint: Tint }> = {
  identity_review: { icon: 'shield-checkmark-outline', tint: 'blue' },
  appeal: { icon: 'shield-checkmark-outline', tint: 'blue' },
  event: { icon: 'calendar-outline', tint: 'teal' },
  membership: { icon: 'card-outline', tint: 'navy' },
  area_change: { icon: 'map-outline', tint: 'green' },
  privacy_request: { icon: 'document-lock-outline', tint: 'purple' },
  security_alert: { icon: 'lock-closed-outline', tint: 'rose' },
  removal_request: { icon: 'images-outline', tint: 'sand' },
};
const DEFAULT_KIND = { icon: 'notifications-outline', tint: 'blue' } as const;

/** Where a notice opens (BR-027); a notice about something with no screen yet opens nothing. */
function targetRoute(item: NotificationItem): Href | null {
  switch (item.targetKind) {
    case 'identity_review':
    case 'appeal':
      return '/verify';
    case 'event':
      return item.targetId ? { pathname: '/events/[id]', params: { id: item.targetId } } : '/events';
    case 'membership':
      return '/card';
    case 'area_change':
      return '/profile/area';
    case 'privacy_request':
      return '/profile/privacy';
    case 'security_alert':
      return '/profile/security';
    case 'removal_request':
      return '/gallery';
    default:
      return null;
  }
}

/** H03: All or Action needed. Reading never clears Action needed; doing the task does (FR-HOME-010). */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const [view, setView] = useState<View_>('all');
  const inbox = useApiQuery(() => api().getNotifications({ view, limit: 50 }), [view]);
  const readAll = useApiAction(async () => {
    await api().markAllNotificationsRead();
    inbox.reload();
  });

  const open = async (item: NotificationItem) => {
    if (!item.read) {
      await api().markNotificationRead(item.id).catch(() => undefined); // opening still works if this fails
    }
    const route = targetRoute(item);
    if (route) router.push(route);
    else inbox.reload();
  };

  return (
    <Screen edges={['bottom']} onRefresh={inbox.reload} refreshing={inbox.loading && inbox.data !== undefined}>
      <SegmentedControl
        label={t('m.inbox.title')}
        selected={view}
        onSelect={setView}
        options={[
          { key: 'all', label: t('m.inbox.all') },
          { key: 'action_needed', label: t('m.inbox.actionNeeded') },
        ]}
      />
      <QueryView query={inbox}>
        {(data) => (
          <View style={styles.list}>
            {data.unread > 0 ? (
              <Button label={t('m.inbox.markAllRead')} variant="quiet" busy={readAll.busy} onPress={() => void readAll.run()} />
            ) : null}
            {data.items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {view === 'all' ? t('m.inbox.empty') : t('m.inbox.emptyAction')}
              </AppText>
            ) : null}
            {data.items.map((item) => {
              const kind = KIND[item.targetKind ?? ''] ?? DEFAULT_KIND;
              return (
                <SurfaceCard
                  key={item.id}
                  onPress={() => void open(item)}
                  accessibilityLabel={localized(item.titleEn, item.titleTa)}
                  style={[styles.item, !item.read && styles.unread]}>
                  <IconTile icon={kind.icon} tint={kind.tint} size={40} />
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <AppText step="card" weight={400} style={styles.flex}>
                        {localized(item.titleEn, item.titleTa)}
                      </AppText>
                      {!item.read ? <View style={styles.dot} accessibilityElementsHidden /> : null}
                    </View>
                    <AppText step="secondary" tone="muted">
                      {localized(item.bodyEn, item.bodyTa)}
                    </AppText>
                    <View style={styles.meta}>
                      <AppText step="caption" tone="muted" style={styles.flex}>
                        {formatDateTime(item.createdAt, language)}
                      </AppText>
                      {item.actionNeeded ? <StatusTag tone="pending" label={t('m.inbox.actionTag')} /> : null}
                    </View>
                  </View>
                </SurfaceCard>
              );
            })}
            <Button label={t('m.inbox.settings')} variant="quiet" onPress={() => router.push('/profile/settings')} />
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  unread: { borderColor: colors.primaryLight },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
