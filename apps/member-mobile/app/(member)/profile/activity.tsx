import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { SurfaceCard } from '@/components/SurfaceCard';
import { useApiQuery } from '@/hooks/useApi';
import { useLanguage } from '@/hooks/useLanguage';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

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
    <Screen edges={['bottom']} onRefresh={activity.reload} refreshing={activity.loading && activity.data !== undefined}>
      <QueryView query={activity}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.profile.activityEmpty')}
            </AppText>
          ) : (
            items.map((item) => (
              <SurfaceCard key={`${item.kind}-${item.reference}-${item.at}`}>
                <AppText step="caption" tone="muted">
                  {t(`m.profile.activity_${item.kind}`)}
                </AppText>
                <AppText step="card">{item.title ?? item.reference}</AppText>
                <AppText step="secondary" tone="muted" mono>
                  {item.reference}
                </AppText>
                <AppText step="secondary" tone="secondary">
                  {`${t(`${STATE_KEYS[item.kind] ?? ''}${item.state}`, { defaultValue: item.state.replace(/_/g, ' ') })} · ${formatDateTime(item.at, language)}`}
                </AppText>
              </SurfaceCard>
            ))
          )
        }
      </QueryView>
    </Screen>
  );
}
