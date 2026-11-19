import type { CommitteeManage } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Screen, StatusTag, SurfaceCard, useApiQuery, useLocalized, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

import { ActivityCard } from './ActivityCard';
import { ApplicationsCard } from './ApplicationsCard';
import { ApprovalsCard } from './ApprovalsCard';
import { ComposeCard } from './ComposeCard';
import { PostedItemsCard } from './PostedItemsCard';
import { RosterCard } from './RosterCard';

/**
 * S18 Committee coordinator tools, for one committee only: applications, what waits for approval,
 * posting, the roster with roles, posted items and the committee's activity (FR-COM-002 to 009).
 * The API refuses anyone who is not this committee's coordinator or secretary (RB-09).
 */
export function CoordinatorTools({ committeeId }: { committeeId: string }) {
  const manage = useApiQuery(() => api().getCommitteeManage(committeeId), [committeeId]);
  useReloadOnFocus(manage.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={manage.reload}
      refreshing={manage.loading && manage.data !== undefined}>
      <FeatureQueryView feature="committees" query={manage}>
        {(data) => <Tools data={data} reload={manage.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function Tools({ data, reload }: { data: CommitteeManage; reload: () => void }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const coordinator = data.role === 'coordinator';
  const meetings = data.recentItems.filter((item) => item.itemType === 'meeting');
  return (
    <>
      <SurfaceCard style={styles.card}>
        <AppText step="title" accessibilityRole="header">
          {localized(data.committee.nameEn, data.committee.nameTa)}
        </AppText>
        <StatusTag tone="neutral" label={t('s.committees.roleHere', { role: t(`m.committees.role_${data.role}`) })} />
        <AppText step="secondary" tone="muted">
          {t('s.committees.scopeNote')}
        </AppText>
      </SurfaceCard>
      {coordinator ? <ApplicationsCard committeeId={data.committee.id} applications={data.applications} onChanged={reload} /> : null}
      <ApprovalsCard
        committeeId={data.committee.id}
        role={data.role}
        items={data.waitingItems}
        posts={data.waitingPosts}
        onChanged={reload}
      />
      <ComposeCard committeeId={data.committee.id} role={data.role} roster={data.roster} meetings={meetings} onPosted={reload} />
      <RosterCard committeeId={data.committee.id} roster={data.roster} canManage={coordinator} onChanged={reload} />
      <PostedItemsCard committeeId={data.committee.id} role={data.role} items={data.recentItems} onChanged={reload} />
      <ActivityCard report={data.report} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
});
