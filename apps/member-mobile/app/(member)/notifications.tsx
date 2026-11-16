import type { NotificationItem } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  ChipRow,
  formatDateTime,
  Notice,
  Screen,
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
    case 'issue':
      return item.targetId ? { pathname: '/issues/[id]', params: { id: item.targetId } } : '/issues';
    case 'volunteer_offer':
      return '/volunteer/assignments';
    case 'volunteer_contact':
      return '/staff/volunteers';
    case 'idea':
      return '/ideas';
    case 'proposal':
      return item.targetId
        ? { pathname: '/ideas/proposals/[id]', params: { id: item.targetId } }
        : { pathname: '/ideas', params: { tab: 'proposals' } };
    case 'support_request':
      return item.targetId ? { pathname: '/support/[id]', params: { id: item.targetId } } : '/support';
    case 'townhall':
      return item.targetId ? { pathname: '/town-halls/[id]', params: { id: item.targetId } } : '/town-halls';
    case 'roster_assignment':
    case 'roster_shift':
      return '/volunteer/assignments';
    case 'misinfo_report':
      return '/official';
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
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={inbox.reload}
      refreshing={inbox.loading && inbox.data !== undefined}>
      <ChipRow
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
            {readAll.error ? <Notice tone="error">{t('m.inbox.markAllReadFailed')}</Notice> : null}
            {data.items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {view === 'all' ? t('m.inbox.empty') : t('m.inbox.emptyAction')}
              </AppText>
            ) : null}
            {data.items.length > 0 ? <SurfaceCard style={styles.inboxList}>
              {data.items.map((item, index) => {
                const route = targetRoute(item);
                const title = localized(item.titleEn, item.titleTa);
                return <SurfaceCard
                key={item.id}
                onPress={() => void open(item)}
                accessibilityLabel={`${!item.read ? `${t('m.inbox.unread')}. ` : ''}${title}${route ? `. ${t('m.inbox.opensDetail')}` : ''}`}
                style={[styles.item, index > 0 && styles.itemDivider, !item.read && styles.unread]}>
                <View style={styles.titleRow}>
                  {!item.read ? <View style={styles.dot} accessibilityElementsHidden /> : null}
                  <AppText step="card" style={styles.flex}>
                    {title}
                  </AppText>
                </View>
                <AppText step="secondary" tone="secondary">
                  {localized(item.bodyEn, item.bodyTa)}
                </AppText>
                <View style={styles.meta}>
                  <AppText step="caption" tone="muted" style={styles.flex}>
                    {formatDateTime(item.createdAt, language)}
                  </AppText>
                  {item.actionNeeded ? <StatusTag tone="pending" label={t('m.inbox.actionTag')} /> : null}
                </View>
              </SurfaceCard>;
              })}
            </SurfaceCard> : null}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  inboxList: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { borderWidth: 0, borderRadius: 0, padding: spacing[3] },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  unread: { backgroundColor: colors.primaryContainer },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
