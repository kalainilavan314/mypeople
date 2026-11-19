import type { CommitteeItem } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  MenuRow,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { THREAD_BODY_MIN, THREAD_TITLE_MIN } from './labels';

/**
 * FR-COM-008, OS-17: the committee's moderated threads. Everything here is written to the whole
 * committee; there is no way to message one person.
 */
export function Discussion({
  committeeId,
  items,
  waiting,
  moderated,
  onChanged,
}: {
  committeeId: string;
  items: CommitteeItem[];
  waiting: CommitteeItem[];
  /** An ordinary member's posts wait for a coordinator or secretary; theirs publish at once. */
  moderated: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const threads = items.filter((item) => item.itemType === 'thread');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [sent, setSent] = useState(false);
  const start = useApiAction(async () => {
    await api().startCommitteeThread(committeeId, title.trim(), body.trim());
    setTitle('');
    setBody('');
    setShowErrors(false);
    setSent(true);
    onChanged();
  });
  const titleShort = title.trim().length < THREAD_TITLE_MIN;
  const bodyShort = body.trim().length < THREAD_BODY_MIN;
  const open = (id: string) =>
    router.push({ pathname: '/committees/[id]/thread/[threadId]', params: { id: committeeId, threadId: id } });

  return (
    <View style={styles.list}>
      <Notice tone="info">{t('m.committees.discussionRules')}</Notice>

      {waiting.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="label">{t('m.committees.yourWaiting')}</AppText>
          {waiting.map((item) => (
            <View key={item.id} style={styles.waiting}>
              <AppText step="card">{item.title}</AppText>
              {item.state === 'returned' ? (
                <StatusTag tone="error" label={t('m.committees.returned', { reason: item.decisionReason ?? '' })} />
              ) : (
                <StatusTag tone="pending" label={t('m.committees.awaiting')} />
              )}
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {threads.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.committees.noThreads')}
        </AppText>
      ) : (
        <SurfaceCard style={styles.rows}>
          {threads.map((item, index) => (
            <MenuRow
              key={item.id}
              first={index === 0}
              icon="chatbubble-outline"
              tint="teal"
              label={item.title}
              hint={`${t('m.committees.replies', { count: item.replies })} · ${formatDate(item.createdAt, language)}`}
              onPress={() => open(item.id)}
            />
          ))}
        </SurfaceCard>
      )}

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.committees.newThread')}
        </AppText>
        <TextField
          label={t('m.committees.threadTitleLabel')}
          value={title}
          maxLength={160}
          onChangeText={(text) => {
            setSent(false);
            setTitle(text);
          }}
          error={showErrors && titleShort ? t('m.committees.titleTooShort') : null}
        />
        <TextField
          label={t('m.committees.threadBody')}
          value={body}
          multiline
          textAlignVertical="top"
          maxLength={4000}
          onChangeText={(text) => {
            setSent(false);
            setBody(text);
          }}
          error={showErrors && bodyShort ? t('m.committees.bodyRequired') : null}
        />
        {sent ? (
          <Notice tone="success">{moderated ? t('m.committees.threadSent') : t('m.committees.threadPosted')}</Notice>
        ) : null}
        {start.error ? <Notice tone="error">{errorMessage(t, start.error, 'committees')}</Notice> : null}
        <Button
          icon="send-outline"
          label={moderated ? t('m.committees.postThread') : t('m.committees.postNow')}
          busy={start.busy}
          onPress={() => {
            if (titleShort || bodyShort) {
              setShowErrors(true);
              return;
            }
            void start.run();
          }}
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  rows: { paddingVertical: 0 },
  waiting: { gap: spacing[1], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider },
});
