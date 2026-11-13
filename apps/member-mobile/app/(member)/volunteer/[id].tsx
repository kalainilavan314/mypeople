import type { VolunteerOffer, VolunteerOpportunity } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  IconTile,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { whenText } from '@/features/volunteer/labels';
import { OfferStatusTag } from '@/features/volunteer/OfferStatusTag';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * H11 Opportunity briefing. All five things a volunteer needs (time, place, role, what to bring
 * and the coordinating team) are on screen before "Offer to help" (FR-VOL-004). An offer gets a
 * receipt; the coordinating team decides (FR-VOL-005). It can be taken back while it waits.
 */
export default function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const opportunity = useApiQuery(() => api().getVolunteerOpportunity(id), [id]);
  useReloadOnFocus(opportunity.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={opportunity.reload}
      refreshing={opportunity.loading && opportunity.data !== undefined}>
      <FeatureQueryView feature="volunteer" query={opportunity}>
        {(data) => <Briefing opportunity={data} reload={opportunity.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function Briefing({ opportunity, reload }: { opportunity: VolunteerOpportunity; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const [receipt, setReceipt] = useState<VolunteerOffer | null>(null);
  const offer = useApiAction(async () => {
    setReceipt(await api().offerToVolunteer(opportunity.id));
    reload();
  });
  const save = useApiAction(async (saved: boolean) => {
    await api().setVolunteerOpportunitySaved(opportunity.id, saved);
    reload();
  });
  const withdraw = useApiAction(async () => {
    const confirmed = await confirmAction({
      title: t('m.volunteer.withdrawTitle'),
      message: t('m.volunteer.withdrawBody'),
      confirmLabel: t('m.volunteer.withdrawOffer'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await api().withdrawVolunteerOffer(opportunity.id);
    setReceipt(null);
    reload();
  });

  const myOffer = opportunity.myOffer;
  const open = opportunity.state === 'open' && new Date(opportunity.startsAt).getTime() > Date.now();
  // A withdrawn offer can be made again; a decided one cannot, from here.
  const canOffer = open && (!myOffer || myOffer.state === 'withdrawn');
  const error = offer.error ?? save.error ?? withdraw.error;
  const busy = offer.busy || save.busy || withdraw.busy;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IconTile icon="hand-left-outline" tint="rose" size={40} />
          <AppText step="secondary" tone="muted" mono style={styles.flex}>
            {opportunity.opportunityRef}
          </AppText>
        </View>
        <AppText step="page" accessibilityRole="header">
          {localized(opportunity.titleEn, opportunity.titleTa)}
        </AppText>
        <View style={styles.tags}>
          {opportunity.state !== 'open' ? (
            <StatusTag
              tone={opportunity.state === 'cancelled' ? 'error' : 'neutral'}
              label={t(`m.volunteer.opportunity_${opportunity.state}`)}
            />
          ) : null}
          {opportunity.saved ? <StatusTag tone="neutral" label={t('m.volunteer.saved')} /> : null}
          {myOffer && !receipt ? <OfferStatusTag state={myOffer.state} /> : null}
        </View>
        <AppText step="body" tone="secondary">
          {localized(opportunity.descriptionEn, opportunity.descriptionTa)}
        </AppText>
      </View>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.volunteer.briefing')}
        </AppText>
        <DetailRow label={t('m.volunteer.when')} value={whenText(opportunity.startsAt, opportunity.endsAt, language)} />
        <DetailRow label={t('m.volunteer.where')} value={localized(opportunity.placeEn, opportunity.placeTa)} />
        <DetailRow label={t('m.volunteer.role')} value={localized(opportunity.roleEn, opportunity.roleTa)} />
        <DetailRow label={t('m.volunteer.bring')} value={localized(opportunity.bringEn, opportunity.bringTa)} />
        <DetailRow label={t('m.volunteer.team')} value={localized(opportunity.teamEn, opportunity.teamTa)} />
        {opportunity.eventId ? (
          <Button
            label={t('m.volunteer.viewEvent')}
            variant="secondary"
            icon="calendar-outline"
            onPress={() => router.push({ pathname: '/events/[id]', params: { id: opportunity.eventId ?? '' } })}
          />
        ) : null}
      </SurfaceCard>

      {receipt ? (
        <ReceiptCard
          title={t('m.volunteer.receiptTitle')}
          referenceLabel={t('m.volunteer.reference')}
          reference={receipt.offerRef}
          body={t('m.volunteer.receiptBody')}>
          <Button label={t('m.volunteer.myAssignments')} icon="list-outline" onPress={() => router.push('/volunteer/assignments')} />
        </ReceiptCard>
      ) : myOffer ? (
        <MyOfferSummary offer={myOffer} />
      ) : null}

      {error ? <Notice tone="error">{errorMessage(t, error, 'volunteer')}</Notice> : null}

      {canOffer ? (
        <Button
          label={t('m.volunteer.offerToHelp')}
          icon="hand-left-outline"
          busy={offer.busy}
          disabled={busy}
          accessibilityHint={t('m.volunteer.offerHint')}
          onPress={() => void offer.run()}
        />
      ) : null}
      {!open && !myOffer ? (
        <AppText step="secondary" tone="muted">
          {t('m.volunteer.notOpenForOffers')}
        </AppText>
      ) : null}
      {myOffer?.state === 'offered' ? (
        <Button
          label={t('m.volunteer.withdrawOffer')}
          variant="danger"
          icon="close-circle-outline"
          busy={withdraw.busy}
          disabled={busy}
          onPress={() => void withdraw.run()}
        />
      ) : null}
      <Button
        label={opportunity.saved ? t('m.volunteer.unsave') : t('m.volunteer.saveForLater')}
        variant="secondary"
        icon={opportunity.saved ? 'bookmark' : 'bookmark-outline'}
        busy={save.busy}
        disabled={busy}
        onPress={() => void save.run(!opportunity.saved)}
      />
    </>
  );
}

/** Where the member's offer stands, with the coordinator's role, meeting point or reason. */
function MyOfferSummary({ offer }: { offer: VolunteerOffer }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const waiting = offer.state === 'offered';
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.volunteer.yourOffer')}
      </AppText>
      <OfferStatusTag state={offer.state} />
      <DetailRow label={t('m.volunteer.reference')} value={offer.offerRef} mono />
      {offer.state === 'confirmed' && offer.roleEn ? (
        <DetailRow label={t('m.volunteer.role')} value={localized(offer.roleEn, offer.roleTa ?? '')} />
      ) : null}
      {offer.state === 'confirmed' && offer.meetingPointEn ? (
        <DetailRow label={t('m.volunteer.meetingPoint')} value={localized(offer.meetingPointEn, offer.meetingPointTa ?? '')} />
      ) : null}
      {offer.decisionReason ? <DetailRow label={t('m.volunteer.reason')} value={offer.decisionReason} /> : null}
      {waiting || offer.state === 'confirmed' ? (
        <>
          <AppText step="secondary" tone="muted">
            {waiting ? t('m.volunteer.awaitingBody') : t('m.volunteer.confirmedBody')}
          </AppText>
          <Button
            label={t('m.volunteer.myAssignments')}
            variant="secondary"
            icon="list-outline"
            onPress={() => router.push('/volunteer/assignments')}
          />
        </>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[3] },
});
