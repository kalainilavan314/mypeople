import type { EventDetail, RsvpResponse } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  ChipRow,
  formatDate,
  formatDateTime,
  formatSpan,
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
import { errorMessage } from '@/lib/errors';

/** E02 to E05: the event's details and the member's answer. Success shows only after the server confirmed it. */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useApiQuery(() => api().getEvent(id), [id]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={event.reload} refreshing={event.loading && event.data !== undefined}>
      <QueryView query={event}>{(data) => <EventBody event={data} reload={event.reload} />}</QueryView>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detail}>
      <AppText step="label">{label}</AppText>
      <AppText step="body" tone="secondary">
        {value}
      </AppText>
    </View>
  );
}

function EventBody({ event, reload }: { event: EventDetail; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const [saved, setSaved] = useState<string | null>(null);
  const respond = useApiAction(async (response: RsvpResponse) => {
    const result = await api().respondToEvent(event.id, response);
    setSaved(result.response);
    reload();
  });
  const cancelled = event.state === 'cancelled';
  const over = new Date(event.endsAt).getTime() < Date.now();
  const answer = event.myResponse === 'waitlisted' ? 'going' : event.myResponse;
  const description = localized(event.descriptionEn, event.descriptionTa);
  const hasDetails = Boolean(description || event.agenda || event.accessibility || event.contactRoute);

  return (
    <>
      <AppText step="page" accessibilityRole="header">
        {localized(event.titleEn, event.titleTa)}
      </AppText>
      <AppText step="secondary" tone="muted" mono>
        {event.eventRef}
      </AppText>

      {cancelled ? (
        <Notice tone="error" title={t('m.events.cancelled')}>
          {event.cancelReason ? t('m.events.cancelReason', { reason: event.cancelReason }) : undefined}
        </Notice>
      ) : null}
      {event.attendedAt ? (
        <StatusTag tone="verified" label={t('m.events.attended', { time: formatDateTime(event.attendedAt, language) })} />
      ) : null}

      <SurfaceCard style={styles.summary}>
        <Detail label={t('m.events.when')} value={`${formatDate(event.startsAt, language)} · ${formatSpan(event.startsAt, event.endsAt, language)}`} />
        <Detail label={t('m.events.where')} value={event.venue} />
        <Detail label={t('m.events.meetingPoint')} value={event.meetingPoint} />
        {event.placesLeft !== null ? (
          <AppText step="secondary" tone="muted">
            {event.placesLeft > 0 ? t('m.events.placesLeft', { count: event.placesLeft }) : t('m.events.full')}
          </AppText>
        ) : null}
      </SurfaceCard>

      {!cancelled && !over ? (
        <SurfaceCard>
          <AppText step="section" accessibilityRole="header">
            {t('m.events.answer')}
          </AppText>
          <ChipRow
            label={t('m.events.answer')}
            selected={answer}
            onSelect={(response) => void respond.run(response)}
            options={[
              { key: 'going', label: t('m.events.going') },
              { key: 'maybe', label: t('m.events.maybe') },
              { key: 'declined', label: t('m.events.declined') },
            ]}
          />
          {respond.busy ? (
            <AppText step="secondary" tone="muted">
              {t('m.common.saving')}
            </AppText>
          ) : null}
          {saved && !respond.busy ? (
            <AppText step="secondary" tone="success" accessibilityLiveRegion="polite">
              {saved === 'waitlisted' ? t('m.events.joinedWaitlist') : t('m.events.answerSaved', { answer: t(`m.events.${saved}`) })}
            </AppText>
          ) : null}
          {event.myResponse === 'waitlisted' && !saved ? <StatusTag tone="pending" label={t('m.events.waitlisted')} /> : null}
          {respond.error ? (
            <Notice tone="error">{`${errorMessage(t, respond.error)} ${t('m.common.notSaved')}`}</Notice>
          ) : null}
          {event.myResponse === 'going' || saved === 'going' ? (
            <Button
              label={t('m.events.showPass')}
              icon="qr-code-outline"
              onPress={() => router.push({ pathname: '/events/[id]/pass', params: { id: event.id } })}
            />
          ) : null}
        </SurfaceCard>
      ) : null}

      {hasDetails ? (
        <>
          <AppText step="section" accessibilityRole="header">{t('m.events.details')}</AppText>
          <SurfaceCard>
            {description ? <AppText step="body" tone="secondary">{description}</AppText> : null}
            <Detail label={t('m.events.agenda')} value={event.agenda} />
            <Detail label={t('m.events.accessibility')} value={event.accessibility} />
            <Detail label={t('m.events.contact')} value={event.contactRoute} />
          </SurfaceCard>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  detail: { gap: 2, paddingVertical: spacing[1] },
});
