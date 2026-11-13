import type { TownHallSession } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  formatDateTime,
  formatSpan,
  Notice,
  Screen,
  SearchField,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { Collapsible } from '@/components/Collapsible';
import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { AskQuestion } from '@/features/townhalls/AskQuestion';
import { readOutcomes, STATE_TONES } from '@/features/townhalls/labels';
import { QuestionItem } from '@/features/townhalls/QuestionItem';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const SEARCH_DELAY_MS = 400;

/**
 * M22, M23 Town hall session: details, the stream or audio-only link while live, a reminder,
 * questions (moderated before others see them) with vote totals, and afterwards the recording,
 * transcripts, answers and outcomes. The question history can be searched.
 */
export default function TownHallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState('');
  const [words, setWords] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setWords(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const session = useApiQuery(() => api().getTownHall(id, words || undefined), [id, words]);
  useReloadOnFocus(session.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={session.reload} refreshing={session.loading && session.data !== undefined}>
      <FeatureQueryView feature="townHalls" query={session}>
        {(data) => <SessionBody session={data} reload={session.reload} search={text} onSearch={setText} searching={words !== ''} />}
      </FeatureQueryView>
    </Screen>
  );
}

type BodyProps = { session: TownHallSession; reload: () => void; search: string; onSearch: (text: string) => void; searching: boolean };

function SessionBody({ session, reload, search, onSearch, searching }: BodyProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const remind = useApiAction(async (on: boolean) => {
    await api().setTownHallReminder(session.id, on);
    reload();
  });
  const live = session.state === 'live';
  const past = session.state === 'ended';
  const open = session.state === 'scheduled' || live;
  const approved = session.questions.filter((question) => question.state === 'approved' && !question.mine).sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const mine = session.questions.filter((question) => question.mine);
  const outcomes = readOutcomes(session.outcomes);

  return (
    <>
      <View style={styles.header}>
        <StatusTag tone={STATE_TONES[session.state]} label={t(`m.townHalls.state_${session.state}`)} />
        <AppText step="page" accessibilityRole="header">
          {localized(session.titleEn, session.titleTa)}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {session.sessionRef}
        </AppText>
        <AppText step="body" tone="secondary">
          {localized(session.descriptionEn, session.descriptionTa)}
        </AppText>
      </View>

      <SurfaceCard style={styles.card}>
        <DetailRow label={t('m.townHalls.when')} value={`${formatDateTime(session.startsAt, language)} (${formatSpan(session.startsAt, session.endsAt, language)})`} />
        <DetailRow label={t('m.townHalls.speakers')} value={localized(session.speakersEn, session.speakersTa)} />
        <DetailRow label={t('m.townHalls.language')} value={t(`m.townHalls.language_${session.language}`)} />
        {session.cancelReason ? <DetailRow label={t('m.townHalls.cancelReason')} value={session.cancelReason} /> : null}
      </SurfaceCard>

      {live ? (
        <SurfaceCard style={styles.card}>
          {session.streamUrl ? (
            <Button label={t('m.townHalls.watch')} icon="play-circle-outline" onPress={() => void Linking.openURL(session.streamUrl ?? '')} />
          ) : null}
          {session.audioUrl ? (
            <Button
              label={t('m.townHalls.listen')}
              variant="secondary"
              icon="headset-outline"
              onPress={() => void Linking.openURL(session.audioUrl ?? '')}
            />
          ) : null}
          {session.captionsUrl ? (
            <Button
              label={t('m.townHalls.captions')}
              variant="quiet"
              icon="text-outline"
              onPress={() => void Linking.openURL(session.captionsUrl ?? '')}
            />
          ) : null}
          {!session.streamUrl && !session.audioUrl ? (
            <AppText step="secondary" tone="muted">
              {t('m.townHalls.noStreamYet')}
            </AppText>
          ) : null}
        </SurfaceCard>
      ) : null}
      {session.state === 'scheduled' ? (
        <SurfaceCard style={styles.card}>
          <AppText step="secondary" tone="muted">
            {t('m.townHalls.streamLater')}
          </AppText>
          <Checkbox
            label={t('m.townHalls.remindMe')}
            checked={session.reminded}
            disabled={remind.busy}
            onChange={(on) => void remind.run(on)}
          />
          {remind.error ? <Notice tone="error">{errorMessage(t, remind.error, 'townHalls')}</Notice> : null}
        </SurfaceCard>
      ) : null}

      {past ? <PastSession session={session} outcomes={outcomes} /> : null}

      {open ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.townHalls.askTitle')}
          </AppText>
          <AskQuestion townHallId={session.id} onAsked={reload} />
        </SurfaceCard>
      ) : null}

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.townHalls.questions')}
        </AppText>
        <SearchField label={t('m.townHalls.searchQuestions')} value={search} onChangeText={onSearch} returnKeyType="search" />
        {approved.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {searching ? t('m.townHalls.noMatches') : t('m.townHalls.noQuestions')}
          </AppText>
        ) : (
          approved.map((question, index) => (
            <View key={question.id} style={index > 0 ? styles.divider : undefined}>
              <QuestionItem question={question} canVote={open} onChanged={reload} />
            </View>
          ))
        )}
      </SurfaceCard>

      {mine.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.townHalls.myQuestions')}
          </AppText>
          {mine.map((question, index) => (
            <View key={question.id} style={index > 0 ? styles.divider : undefined}>
              <QuestionItem question={question} canVote={false} onChanged={reload} />
            </View>
          ))}
        </SurfaceCard>
      ) : null}
    </>
  );
}

function PastSession({ session, outcomes }: { session: TownHallSession; outcomes: ReturnType<typeof readOutcomes> }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.townHalls.afterSession')}
      </AppText>
      {session.recordingUrl ? (
        <Button
          label={t('m.townHalls.recording')}
          variant="secondary"
          icon="play-circle-outline"
          onPress={() => void Linking.openURL(session.recordingUrl ?? '')}
        />
      ) : (
        <AppText step="secondary" tone="muted">
          {t('m.townHalls.noRecording')}
        </AppText>
      )}
      {session.transcriptTa ? (
        <Collapsible title={t('m.townHalls.transcriptTa')}>
          <AppText step="body" selectable>
            {session.transcriptTa}
          </AppText>
        </Collapsible>
      ) : null}
      {session.transcriptEn ? (
        <Collapsible title={t('m.townHalls.transcriptEn')}>
          <AppText step="body" selectable>
            {session.transcriptEn}
          </AppText>
        </Collapsible>
      ) : null}
      {outcomes.length > 0 ? (
        <View style={styles.outcomes}>
          <AppText step="label">{t('m.townHalls.outcomes')}</AppText>
          {outcomes.map((outcome, index) => (
            <View key={`${outcome.textEn}-${index}`} style={styles.outcome}>
              <AppText step="body">{localized(outcome.textEn, outcome.textTa)}</AppText>
              {outcome.caseNumber && outcome.caseId ? (
                <Button
                  label={t('m.townHalls.viewCase', { number: outcome.caseNumber })}
                  variant="quiet"
                  icon="document-text-outline"
                  onPress={() => router.push({ pathname: '/issues/[id]', params: { id: outcome.caseId ?? '' } })}
                />
              ) : outcome.caseNumber ? (
                <AppText step="secondary" tone="muted" mono>
                  {t('m.townHalls.caseNumber', { number: outcome.caseNumber })}
                </AppText>
              ) : null}
              {outcome.promiseId ? (
                <Button
                  label={t('m.townHalls.viewPromise')}
                  variant="quiet"
                  icon="flag-outline"
                  onPress={() => router.push({ pathname: '/promises/[id]', params: { id: outcome.promiseId ?? '' } })}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
  outcomes: { gap: spacing[2] },
  outcome: { gap: 2 },
});
