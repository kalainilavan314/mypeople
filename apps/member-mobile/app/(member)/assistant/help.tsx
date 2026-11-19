import type { AssistantHandover } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { HANDOVER_TONES, NOTE_MAX, NOTE_MIN } from '@/features/assistant/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Hand over to a person (FR-AIA-007). The conversation goes with the request only when the member
 * ticks the box; otherwise staff see the request alone. Replies arrive here and as a notification.
 */
export default function AssistantHelpScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const params = useLocalSearchParams<{ conversation?: string; count?: string }>();
  const conversationId = params.conversation ?? null;
  const shareable = Number(params.count ?? 0);
  const requests = useApiQuery(() => api().listMyAssistantHandovers());
  useReloadOnFocus(requests.reload);

  const [request, setRequest] = useState('');
  const [share, setShare] = useState(false);
  const [showError, setShowError] = useState(false);
  const [sent, setSent] = useState(false);
  const short = request.trim().length < NOTE_MIN;

  const send = useApiAction(async () => {
    await api().requestAssistantHandover({
      request: request.trim(),
      language,
      conversationId: share ? conversationId : null,
      shareConversation: share && conversationId !== null,
    });
    setRequest('');
    setShare(false);
    setShowError(false);
    setSent(true);
    requests.reload();
  });

  const submit = () => {
    if (short) {
      setShowError(true);
      return;
    }
    if (!send.busy) void send.run();
  };

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={requests.reload}
      refreshing={requests.loading && requests.data !== undefined}>
      <FeatureQueryView feature="assistant" query={requests}>
        {(items) => (
          <View style={styles.body}>
            <AppText step="body" tone="secondary">
              {t('m.assistant.helpIntro')}
            </AppText>

            <SurfaceCard style={styles.card}>
              <TextField
                label={t('m.assistant.requestLabel')}
                hint={t('m.assistant.requestHint')}
                value={request}
                multiline
                textAlignVertical="top"
                maxLength={NOTE_MAX}
                onChangeText={(text) => {
                  setRequest(text);
                  setSent(false);
                }}
                error={showError && short ? t('m.assistant.requestTooShort') : null}
              />
              {conversationId && shareable > 0 ? (
                <View style={styles.share}>
                  <Checkbox
                    label={t('m.assistant.shareConversation', { count: shareable })}
                    checked={share}
                    onChange={setShare}
                  />
                  <AppText step="caption" tone="muted">
                    {t('m.assistant.shareHint')}
                  </AppText>
                </View>
              ) : null}
              {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'assistant')}</Notice> : null}
              {sent ? (
                <AppText step="secondary" tone="success" accessibilityLiveRegion="polite">
                  {t('m.assistant.requestSent')}
                </AppText>
              ) : null}
              <Button
                label={t('m.assistant.sendRequest')}
                icon="send-outline"
                busy={send.busy}
                busyLabel={t('m.common.sending')}
                onPress={submit}
              />
            </SurfaceCard>

            <View style={styles.section}>
              <AppText step="section">{t('m.assistant.myRequests')}</AppText>
              {items.length === 0 ? (
                <AppText step="secondary" tone="muted">
                  {t('m.assistant.noRequests')}
                </AppText>
              ) : (
                items.map((item) => <RequestCard key={item.id} item={item} />)
              )}
            </View>
          </View>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

function RequestCard({ item }: { item: AssistantHandover }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard style={styles.card}>
      <StatusTag tone={HANDOVER_TONES[item.state]} label={t(`m.assistant.state_${item.state}`)} />
      <AppText step="body">{item.request}</AppText>
      <AppText step="caption" tone="muted">
        {`${formatDateTime(item.createdAt, language)} · ${
          item.sharedMessages > 0 ? t('m.assistant.shared', { count: item.sharedMessages }) : t('m.assistant.notShared')
        }`}
      </AppText>
      {item.reply ? (
        <View style={styles.reply}>
          <AppText step="label" tone="primary">
            {t('m.assistant.replyLabel')}
          </AppText>
          <AppText step="body">{item.reply}</AppText>
          {item.repliedAt ? (
            <AppText step="caption" tone="muted">
              {formatDateTime(item.repliedAt, language)}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
  share: { gap: spacing[1] },
  section: { gap: spacing[3] },
  reply: { gap: spacing[1], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
});
