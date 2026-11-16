import type { ManagedVolunteerOpportunity } from '@my-people/api-client';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDateTime,
  Notice,
  Screen,
  SegmentedControl,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { InboxItem } from '@/features/staff/volunteers/InboxItem';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

type View_ = 'offers' | 'inbox';

/**
 * S10 Volunteer coordination: open opportunities in the coordinator's areas with the offers
 * waiting for a decision, and the volunteers' messages and change requests to answer. The API
 * checks volunteers.manage and the area on every request.
 */
export default function StaffVolunteersScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const [view, setView] = useState<View_>('offers');
  if (!permissions.has('volunteers.manage')) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.volunteers.noAccess')}</Notice>
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <SegmentedControl
        label={t('s.volunteers.title')}
        selected={view}
        onSelect={setView}
        options={[
          { key: 'offers', label: t('s.volunteers.offers') },
          { key: 'inbox', label: t('s.volunteers.inbox') },
        ]}
      />
      {view === 'offers' ? <Opportunities /> : <Inbox />}
    </Screen>
  );
}

function Opportunities() {
  const { t } = useTranslation();
  const opportunities = useApiQuery(() => api().listManagedVolunteerOpportunities(['open']));
  useReloadOnFocus(opportunities.reload);
  return (
    <QueryView query={opportunities}>
      {(items) =>
        items.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('s.volunteers.noOpportunities')}
          </AppText>
        ) : (
          <View style={styles.list}>
            {[...items]
              .sort((a, b) => b.waiting - a.waiting)
              .map((item) => (
                <OpportunityRow key={item.id} opportunity={item} />
              ))}
          </View>
        )
      }
    </QueryView>
  );
}

function OpportunityRow({ opportunity }: { opportunity: ManagedVolunteerOpportunity }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(opportunity.titleEn, opportunity.titleTa);
  const waiting = t('s.volunteers.waiting', { count: opportunity.waiting });
  const places = t('s.volunteers.places', { confirmed: opportunity.confirmed, places: opportunity.places });
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/staff/volunteers/[id]', params: { id: opportunity.id } })}
      accessibilityLabel={`${title}. ${waiting}. ${places}`}
      accessibilityHint={t('s.volunteers.opensOffers')}>
      <AppText step="card">{title}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {opportunity.opportunityRef}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {formatDateTime(opportunity.startsAt, language)}
      </AppText>
      <StatusTag tone={opportunity.waiting > 0 ? 'pending' : 'neutral'} label={waiting} />
      <AppText step="secondary" tone="secondary">
        {places}
      </AppText>
    </SurfaceCard>
  );
}

function Inbox() {
  const { t } = useTranslation();
  const inbox = useApiQuery(() => api().listVolunteerInbox());
  const reload = useCallback(() => inbox.reload(), [inbox.reload]);
  useReloadOnFocus(reload);
  return (
    <QueryView query={inbox}>
      {(items) =>
        items.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('s.volunteers.inboxEmpty')}
          </AppText>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <InboxItem key={item.id} item={item} onAnswered={reload} />
            ))}
          </View>
        )
      }
    </QueryView>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
