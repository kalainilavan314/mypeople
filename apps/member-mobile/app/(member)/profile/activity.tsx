import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import { AppText, formatDateTime, Screen, SurfaceCard, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

// Each kind's states already have words elsewhere in the app.
const STATE_KEYS: Record<string, string> = {
  identity_review: 'm.verify.status_',
  appeal: 'm.verify.appealState_',
  event: 'm.events.',
  removal_request: 'm.gallery.state_',
  area_change: 'm.profile.areaState_',
  privacy_request: 'm.profile.requestState_',
};

/** P03 My Activity: receipts for what the member has asked for or taken part in, newest first. */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const activity = useApiQuery(() => api().listMyActivity({ limit: 100 }));
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={activity.reload}
      refreshing={activity.loading && activity.data !== undefined}>
      <QueryView query={activity}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.profile.activityEmpty')}
            </AppText>
          ) : (
            <SurfaceCard style={styles.list}>
              {items.map((item, index) => (
                <View
                  key={`${item.kind}-${item.reference}-${item.at}`}
                  style={[styles.item, index > 0 && styles.itemDivider]}>
                  <AppText step="caption" tone="primary">
                    {t(`m.profile.activity_${item.kind}`)}
                  </AppText>
                  {item.title ? <AppText step="card">{item.title}</AppText> : null}
                  <AppText step="secondary" tone="muted" mono>
                    {item.reference}
                  </AppText>
                  <AppText step="secondary" tone="secondary">
                    {t(`${STATE_KEYS[item.kind] ?? ''}${item.state}`, { defaultValue: item.state.replace(/_/g, ' ') })}
                  </AppText>
                  <AppText step="caption" tone="muted">
                    {formatDateTime(item.at, language)}
                  </AppText>
                </View>
              ))}
            </SurfaceCard>
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { gap: spacing[1], padding: spacing[3] },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
