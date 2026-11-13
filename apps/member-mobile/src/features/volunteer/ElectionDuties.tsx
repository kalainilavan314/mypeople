import type { MyRosterShift } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  confirmAction,
  formatTime,
  Notice,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useLanguage,
  useLocalized,
  type Loaded,
  type Tone,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage, featureClosed } from '@/lib/errors';

import { whenText } from './labels';

const STATE_TONES: Record<MyRosterShift['state'], Tone> = {
  offered: 'pending',
  accepted: 'verified',
  declined: 'neutral',
  cancelled: 'error',
};

/**
 * M30 Election duties: shifts the roster offered the member, answered here, with check-in and
 * check-out. Checking in records a time and, if the member ticks it, that they are at the site;
 * never a location, and the app never records how anyone votes.
 */
export function ElectionDuties({ query }: { query: Loaded<MyRosterShift[]> }) {
  const { t } = useTranslation();
  // The election roster is open only around an election; while it is off there is nothing to list.
  if (query.data === undefined && !query.loading && featureClosed(query.error)) return null;
  return (
    <QueryView query={query}>
      {(items) =>
        items.length === 0 ? null : (
          <View style={styles.list}>
            <AppText step="section" accessibilityRole="header">
              {t('m.election.title')}
            </AppText>
            <AppText step="secondary" tone="secondary">
              {t('m.election.privacy')}
            </AppText>
            {items.map((item) => (
              <ShiftCard key={item.assignmentId} item={item} reload={query.reload} />
            ))}
          </View>
        )
      }
    </QueryView>
  );
}

function ShiftCard({ item, reload }: { item: MyRosterShift; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const [atSite, setAtSite] = useState(false);
  const act = useApiAction(async (action: 'accept' | 'decline' | 'check_in' | 'check_out') => {
    if (action === 'decline') {
      const yes = await confirmAction({
        title: t('m.election.declineTitle'),
        message: t('m.election.declineBody'),
        confirmLabel: t('m.election.decline'),
        cancelLabel: t('m.common.cancel'),
        destructive: true,
      });
      if (!yes) return;
    }
    if (action === 'accept' || action === 'decline') await api().answerRosterShift(item.assignmentId, action === 'accept');
    else if (action === 'check_in') await api().checkInRosterShift(item.assignmentId, atSite || undefined);
    else await api().checkOutRosterShift(item.assignmentId);
    reload();
  });
  const { shift } = item;
  const checkedIn = item.checkedInAt !== null;
  const checkedOut = item.checkedOutAt !== null;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{localized(shift.roleEn, shift.roleTa)}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {shift.periodRef}
      </AppText>
      <StatusTag tone={STATE_TONES[item.state]} label={t(`m.election.state_${item.state}`)} />
      <DetailRow label={t('m.election.when')} value={whenText(shift.startsAt, shift.endsAt, language)} />
      <DetailRow label={t('m.election.site')} value={localized(shift.siteEn, shift.siteTa)} />
      {checkedIn && item.checkedInAt ? (
        <DetailRow
          label={t('m.election.checkedIn')}
          value={item.siteConfirmed ? t('m.election.checkedInAtSite', { time: formatTime(item.checkedInAt, language) }) : formatTime(item.checkedInAt, language)}
        />
      ) : null}
      {checkedOut && item.checkedOutAt ? <DetailRow label={t('m.election.checkedOut')} value={formatTime(item.checkedOutAt, language)} /> : null}
      {act.error ? <Notice tone="error">{errorMessage(t, act.error)}</Notice> : null}

      {item.state === 'offered' ? (
        <>
          <Button label={t('m.election.accept')} icon="checkmark" busy={act.busy} onPress={() => void act.run('accept')} />
          <Button label={t('m.election.decline')} variant="secondary" disabled={act.busy} onPress={() => void act.run('decline')} />
        </>
      ) : null}
      {item.state === 'accepted' && !checkedIn ? (
        <>
          <Checkbox label={t('m.election.atSite')} checked={atSite} onChange={setAtSite} accessibilityHint={t('m.election.atSiteHint')} />
          <Button label={t('m.election.checkIn')} icon="log-in-outline" busy={act.busy} onPress={() => void act.run('check_in')} />
        </>
      ) : null}
      {item.state === 'accepted' && checkedIn && !checkedOut ? (
        <Button label={t('m.election.checkOut')} variant="secondary" icon="log-out-outline" busy={act.busy} onPress={() => void act.run('check_out')} />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
});
