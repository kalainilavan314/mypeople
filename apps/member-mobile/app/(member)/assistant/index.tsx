import type { AssistantHome, AssistantLanguage, AssistantMessage } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDate,
  formatDateTime,
  MenuRow,
  Notice,
  Screen,
  SegmentedControl,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { AnswerCard } from '@/features/assistant/AnswerCard';
import { exchanges, QUESTION_MAX } from '@/features/assistant/labels';
import { QuestionBubble } from '@/features/assistant/QuestionBubble';
import { VoiceInput } from '@/features/voice/VoiceInput';
import { appendTranscript } from '@/features/voice/voiceTypes';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M28 Tamil AI assistant (FR-AIA-001 to 010). Answers come only from approved sources and cite them;
 * the "AI can be wrong" notice is always shown; a person is one tap away. While no AI service or no
 * approved model is configured, the screen says so and nothing the member types is sent anywhere.
 */
export default function AssistantScreen() {
  const { conversation } = useLocalSearchParams<{ conversation?: string }>();
  const home = useApiQuery(() => api().getAssistantHome());
  useReloadOnFocus(home.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={home.reload}
      refreshing={home.loading && home.data !== undefined}>
      <FeatureQueryView feature="assistant" query={home}>
        {(data) => <AssistantBody home={data} openFirst={conversation ?? null} reloadHome={home.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function AssistantBody({
  home,
  openFirst,
  reloadHome,
}: {
  home: AssistantHome;
  openFirst: string | null;
  reloadHome: () => void;
}) {
  const { t } = useTranslation();
  const appLanguage = useLanguage();
  // Tamil by default (FR-AIA-001); the member may ask for English answers.
  const [language, setLanguage] = useState<AssistantLanguage>('ta');
  const [question, setQuestion] = useState('');
  const [showError, setShowError] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [deletesOn, setDeletesOn] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const open = useApiAction(async (id: string) => {
    const loaded = await api().getAssistantConversation(id);
    setConversationId(loaded.id);
    setMessages(loaded.messages);
    setLanguage(loaded.language);
    setDeletesOn(loaded.deletedAfter);
    setDeleted(false);
  });
  const opened = useRef(false);
  useEffect(() => {
    if (openFirst && !opened.current) {
      opened.current = true;
      void open.run(openFirst);
    }
  }, [openFirst, open]);

  const ask = useApiAction(async () => {
    const result = await api().askAssistant({ text: question.trim(), language, conversationId });
    if (conversationId === null) setDeletesOn(null);
    setConversationId(result.conversationId);
    setMessages((current) => [...current, result.question, result.answer]);
    setQuestion('');
    setShowError(false);
    setDeleted(false);
    reloadHome();
  });

  const remove = useApiAction(async () => {
    if (!conversationId) return;
    const sure = await confirmAction({
      title: t('m.assistant.deleteTitle'),
      message: t('m.assistant.deleteBody'),
      confirmLabel: t('m.assistant.deleteConversation'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!sure) return;
    await api().deleteAssistantConversation(conversationId);
    startNew();
    setDeleted(true);
    reloadHome();
  });

  function startNew() {
    setConversationId(null);
    setMessages([]);
    setDeletesOn(null);
    setQuestion('');
    setShowError(false);
  }

  const talkToPerson = () =>
    router.push(
      conversationId
        ? { pathname: '/assistant/help', params: { conversation: conversationId, count: String(messages.length) } }
        : '/assistant/help',
    );

  const changed = (message: AssistantMessage) =>
    setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));

  const submit = () => {
    if (!question.trim()) {
      setShowError(true);
      return;
    }
    if (!ask.busy) void ask.run();
  };

  const earlier = home.conversations.filter((item) => item.id !== conversationId);

  return (
    <View style={styles.body}>
      <Notice tone="warning" title={t('m.assistant.aiWarningTitle')}>
        {t('m.assistant.aiWarningBody')}
      </Notice>

      {!home.available ? (
        <Notice tone="info" title={t('m.assistant.unavailableTitle')}>
          {t(`m.assistant.unavailable_${home.reason ?? 'provider_not_configured'}`)}
        </Notice>
      ) : (
        <>
          <AppText step="body" tone="secondary">
            {t('m.assistant.intro')}
          </AppText>

          <SurfaceCard style={styles.card}>
            <AppText step="label">{t('m.assistant.answerIn')}</AppText>
            <SegmentedControl
              label={t('m.assistant.answerIn')}
              selected={language}
              onSelect={setLanguage}
              options={[
                { key: 'ta', label: t('m.assistant.languageTa') },
                { key: 'en', label: t('m.assistant.languageEn') },
              ]}
            />
            <TextField
              label={t('m.assistant.questionLabel')}
              hint={t('m.assistant.questionHint', { max: QUESTION_MAX })}
              placeholder={t('m.assistant.questionPlaceholder')}
              value={question}
              multiline
              textAlignVertical="top"
              maxLength={QUESTION_MAX}
              onChangeText={setQuestion}
              error={showError && !question.trim() ? t('m.assistant.questionRequired') : null}
            />
            <VoiceInput
              language={language}
              onTranscript={(spoken) => setQuestion((current) => appendTranscript(current, spoken).slice(0, QUESTION_MAX))}
            />
            {ask.error ? <Notice tone="error">{errorMessage(t, ask.error, 'assistant')}</Notice> : null}
            <Button
              label={t('m.assistant.ask')}
              icon="send-outline"
              busy={ask.busy}
              busyLabel={t('m.assistant.preparing')}
              onPress={submit}
            />
            <AppText step="caption" tone="muted">
              {t('m.assistant.privacyNote', { days: home.retentionDays })}
            </AppText>
          </SurfaceCard>
        </>
      )}

      {deleted ? (
        <AppText step="secondary" tone="success" accessibilityLiveRegion="polite">
          {t('m.assistant.deleted')}
        </AppText>
      ) : null}
      {open.error ? <Notice tone="error">{errorMessage(t, open.error, 'assistant')}</Notice> : null}

      {conversationId ? (
        <View style={styles.actions}>
          <Button label={t('m.assistant.newConversation')} icon="add-circle-outline" variant="secondary" onPress={startNew} />
          <Button
            label={t('m.assistant.deleteConversation')}
            icon="trash-outline"
            variant="quiet"
            busy={remove.busy}
            onPress={() => void remove.run()}
          />
          {remove.error ? <Notice tone="error">{errorMessage(t, remove.error, 'assistant')}</Notice> : null}
          {deletesOn ? (
            <AppText step="caption" tone="muted">
              {t('m.assistant.deletesOn', { date: formatDate(deletesOn, appLanguage) })}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {open.busy ? (
        <AppText step="secondary" tone="muted" accessibilityLiveRegion="polite">
          {t('m.common.loading')}
        </AppText>
      ) : messages.length === 0 ? (
        home.available ? (
          <AppText step="secondary" tone="muted">
            {t('m.assistant.emptyChat')}
          </AppText>
        ) : null
      ) : (
        <View style={styles.list}>
          {exchanges(messages).map(({ question: asked, answer }) => (
            <View key={asked.id} style={styles.exchange}>
              <QuestionBubble message={asked} />
              {answer ? (
                <AnswerCard message={answer} language={language} onChanged={changed} onTalkToPerson={talkToPerson} />
              ) : null}
            </View>
          ))}
        </View>
      )}

      <SurfaceCard style={styles.rowCard}>
        <MenuRow
          first
          icon="people-outline"
          tint="teal"
          label={t('m.assistant.talkToPerson')}
          hint={
            home.openHandovers > 0
              ? `${t('m.assistant.myRequests')}: ${home.openHandovers} · ${t('m.assistant.state_open')}`
              : t('m.assistant.helpIntro')
          }
          onPress={talkToPerson}
        />
      </SurfaceCard>

      {home.available || earlier.length > 0 ? (
        <View style={styles.section}>
          <AppText step="section">{t('m.assistant.earlier')}</AppText>
          <AppText step="caption" tone="muted">
            {t('m.assistant.earlierHint', { days: home.retentionDays })}
          </AppText>
          {earlier.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.assistant.noEarlier')}
            </AppText>
          ) : (
            <SurfaceCard style={styles.rowCard}>
              {earlier.map((item, index) => (
                <MenuRow
                  key={item.id}
                  first={index === 0}
                  icon="chatbubble-outline"
                  label={item.preview}
                  hint={`${t('m.assistant.messageCount', { count: item.messages })} · ${formatDateTime(item.lastMessageAt, appLanguage)}`}
                  onPress={() => void open.run(item.id)}
                />
              ))}
            </SurfaceCard>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
  rowCard: { paddingVertical: 0 },
  actions: { gap: spacing[2] },
  list: { gap: spacing[4] },
  exchange: { gap: spacing[2] },
  section: { gap: spacing[2] },
});
