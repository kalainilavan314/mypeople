import type { CommitteeThread } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { REPLY_MIN } from '@/features/committees/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** One committee thread with its published replies, and a reply form (FR-COM-008, no direct messages). */
export default function CommitteeThreadScreen() {
  const { id, threadId } = useLocalSearchParams<{ id: string; threadId: string }>();
  const thread = useApiQuery(() => api().getCommitteeThread(id, threadId), [id, threadId]);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={thread.reload}
      refreshing={thread.loading && thread.data !== undefined}>
      <FeatureQueryView feature="committees" query={thread}>
        {(data) => <ThreadView committeeId={id} data={data} reload={thread.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function ThreadView({ committeeId, data, reload }: { committeeId: string; data: CommitteeThread; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [body, setBody] = useState('');
  const [showError, setShowError] = useState(false);
  const [sent, setSent] = useState<'waiting' | 'published' | null>(null);
  const send = useApiAction(async () => {
    const post = await api().replyInCommitteeThread(committeeId, data.thread.id, body.trim());
    setBody('');
    setShowError(false);
    setSent(post.state === 'published' ? 'published' : 'waiting');
    reload();
  });
  const short = body.trim().length < REPLY_MIN;
  const open = data.thread.state === 'published';

  return (
    <>
      <SurfaceCard style={styles.card}>
        <AppText step="title" accessibilityRole="header">
          {data.thread.title}
        </AppText>
        <AppText step="caption" tone="muted">
          {t('m.committees.byOn', { name: data.thread.authorName, date: formatDateTime(data.thread.createdAt, language) })}
        </AppText>
        <AppText step="body">{data.thread.body}</AppText>
        {!open ? <StatusTag tone="pending" label={t('m.committees.awaiting')} /> : null}
      </SurfaceCard>

      <View style={styles.posts}>
        {data.posts.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('m.committees.noReplies')}
          </AppText>
        ) : (
          data.posts.map((post) => (
            <SurfaceCard key={post.id} style={styles.card}>
              <AppText step="caption" tone="muted">
                {t('m.committees.byOn', { name: post.authorName, date: formatDateTime(post.createdAt, language) })}
              </AppText>
              <AppText step="body">{post.body}</AppText>
              {post.state === 'awaiting_approval' ? <StatusTag tone="pending" label={t('m.committees.awaiting')} /> : null}
              {post.state === 'returned' ? (
                <StatusTag tone="error" label={t('m.committees.returned', { reason: post.decisionReason ?? '' })} />
              ) : null}
            </SurfaceCard>
          ))
        )}
      </View>

      {open ? (
        <SurfaceCard style={[styles.card, styles.form]}>
          <TextField
            label={t('m.committees.replyLabel')}
            value={body}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            onChangeText={(text) => {
              setSent(null);
              setBody(text);
            }}
            error={showError && short ? t('m.committees.bodyRequired') : null}
          />
          {sent ? (
            <Notice tone="success">{sent === 'waiting' ? t('m.committees.replySent') : t('m.committees.replyPosted')}</Notice>
          ) : null}
          {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'committees')}</Notice> : null}
          <Button
            icon="send-outline"
            label={t('m.committees.sendReply')}
            busy={send.busy}
            onPress={() => {
              if (short) {
                setShowError(true);
                return;
              }
              void send.run();
            }}
          />
        </SurfaceCard>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  posts: { gap: spacing[3] },
  form: { borderTopWidth: 1, borderTopColor: colors.divider },
});
