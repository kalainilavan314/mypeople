import type { AssistedQueueItem, AssistedState } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDate,
  formatDateTime,
  Notice,
  Screen,
  SegmentedControl,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { STATE_TONE } from '@/features/staff/assisted/labels';
import { canAssist } from '@/features/staff/assisted/problems';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

type View_ = 'open' | 'done';
const FINISHED: AssistedState[] = ['completed', 'cancelled', 'closed'];

/**
 * S04 queue (FR-IDV-014, FR-STF-004, OD-04): members in the person's areas who asked for help
 * verifying, longest waiting first. Needs the assisted-session grant or members.verify; the API
 * checks the permission and the member's area on every request.
 */
export default function AssistedQueueScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const [view, setView] = useState<View_>('open');
  const queue = useApiQuery(() => api().listAssistedRequests(view === 'open' ? [] : FINISHED), [view]);
  useReloadOnFocus(queue.reload);

  if (!canAssist(permissions)) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.assisted.noAccess')}</Notice>
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={queue.reload} refreshing={queue.loading && queue.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('s.assisted.queueIntro')}
      </AppText>
      <SegmentedControl
        label={t('s.assisted.title')}
        selected={view}
        onSelect={setView}
        options={[
          { key: 'open', label: t('s.assisted.open') },
          { key: 'done', label: t('s.assisted.done') },
        ]}
      />
      <QueryView query={queue}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('s.assisted.none')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <RequestRow key={item.id} item={item} />
              ))}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

function RequestRow({ item }: { item: AssistedQueueItem }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const state = t(`s.assisted.state_${item.state}`);
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/staff/assisted-verification/[id]', params: { id: item.id } } as Href)}
      accessibilityLabel={`${item.requestRef}. ${state}. ${t(`s.assisted.route_${item.route}`)}`}>
      <AppText step="card" mono>
        {item.requestRef}
      </AppText>
      <StatusTag tone={STATE_TONE[item.state]} label={state} />
      <AppText step="secondary" tone="secondary">
        {`${t(`s.assisted.reason_${item.reason}`)} · ${t(`s.assisted.route_${item.route}`)}`}
      </AppText>
      <AppText step="secondary" tone="muted">
        {item.state === 'scheduled' && item.scheduledFor
          ? t('s.assisted.arranged', { when: formatDateTime(item.scheduledFor, language), place: item.meetingPlace ?? '' })
          : t('s.assisted.preferred', {
              day: item.preferredDate ? formatDate(item.preferredDate, language) : t('s.assisted.anyDay'),
              time: item.preferredTime ? t(`s.assisted.time_${item.preferredTime}`) : t('s.assisted.anyTime'),
            })}
      </AppText>
      <AppText step="caption" tone="muted">
        {t('s.assisted.asked', { date: formatDate(item.createdAt, language) })}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
});
