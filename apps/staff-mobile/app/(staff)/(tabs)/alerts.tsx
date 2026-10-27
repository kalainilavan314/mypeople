import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';
import {
  AppText,
  Button,
  formatDateTime,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/**
 * S14: the staff member's own notices (for example a photo removal request
 * open 18 hours). Push texts carry no personal data; the detail is here.
 */
export default function AlertsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const inbox = useApiQuery(() => api().getNotifications({ limit: 50 }));
  useReloadOnFocus(inbox.reload);
  const readAll = useApiAction(async () => {
    await api().markAllNotificationsRead();
    inbox.reload();
  });

  return (
    <Screen edges={[]} onRefresh={inbox.reload} refreshing={inbox.loading && inbox.data !== undefined}>
      <QueryView query={inbox}>
        {(data) => (
          <>
            {data.unread > 0 ? (
              <Button label={t('s.alerts.markAllRead')} variant="quiet" busy={readAll.busy} onPress={() => void readAll.run()} />
            ) : null}
            {data.items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('s.alerts.empty')}
              </AppText>
            ) : null}
            {data.items.map((item) => (
              <SurfaceCard key={item.id} style={!item.read && styles.unread}>
                <AppText step="card">{localized(item.titleEn, item.titleTa)}</AppText>
                <AppText step="secondary" tone="secondary">
                  {localized(item.bodyEn, item.bodyTa)}
                </AppText>
                <View style={styles.meta}>
                  <AppText step="caption" tone="muted" style={styles.flex}>
                    {formatDateTime(item.createdAt, language)}
                  </AppText>
                  {item.actionNeeded ? <StatusTag tone="pending" label={t('s.alerts.actionNeeded')} /> : null}
                </View>
              </SurfaceCard>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { borderColor: colors.primaryLight },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
