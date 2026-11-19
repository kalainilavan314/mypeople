import type { CommitteeItem, CommitteeRole, CommitteeWaitingPost } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { committeeErrorMessage } from './committeeErrors';

const REASON_MIN = 3;

/**
 * S18: what waits for a decision. Minutes are approved by a coordinator other than their author
 * (FR-COM-005); members' threads and replies by a coordinator or secretary (FR-COM-008).
 */
export function ApprovalsCard({
  committeeId,
  role,
  items,
  posts,
  onChanged,
}: {
  committeeId: string;
  role: CommitteeRole;
  items: CommitteeItem[];
  posts: CommitteeWaitingPost[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.committees.waitingApproval')}
      </AppText>
      {items.length === 0 && posts.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('s.committees.noWaiting')}
        </AppText>
      ) : null}
      {items.map((item) => {
        const minutes = item.itemType === 'minutes';
        const blocked = minutes && (role !== 'coordinator' || item.mine);
        return (
          <Decision
            key={item.id}
            heading={minutes ? t('s.committees.minutesFor') : t('s.committees.threadFrom', { name: item.authorName })}
            title={item.title}
            body={item.body}
            when={item.createdAt}
            blockedReason={blocked ? t('s.committees.otherCoordinatorApproves') : null}
            decide={(approve, reason) => api().decideCommitteeItem(committeeId, item.id, approve, reason)}
            onChanged={onChanged}
          />
        );
      })}
      {posts.map((post) => (
        <Decision
          key={post.id}
          heading={t('s.committees.replyIn', { title: post.threadTitle })}
          title={post.authorName}
          body={post.body}
          when={post.createdAt}
          blockedReason={null}
          decide={(approve, reason) => api().decideCommitteePost(committeeId, post.id, approve ? 'publish' : 'return', reason)}
          onChanged={onChanged}
        />
      ))}
    </SurfaceCard>
  );
}

function Decision({
  heading,
  title,
  body,
  when,
  blockedReason,
  decide,
  onChanged,
}: {
  heading: string;
  title: string;
  body: string;
  when: string;
  blockedReason: string | null;
  decide: (approve: boolean, reason?: string) => Promise<unknown>;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);
  const run = useApiAction(async (approve: boolean) => {
    await decide(approve, approve ? undefined : reason.trim());
    onChanged();
  });
  const short = reason.trim().length < REASON_MIN;

  return (
    <View style={styles.entry}>
      <AppText step="caption" tone="primary">
        {heading}
      </AppText>
      <AppText step="card">{title}</AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(when, language)}
      </AppText>
      <AppText step="body">{body}</AppText>
      {blockedReason ? (
        <AppText step="secondary" tone="muted">
          {blockedReason}
        </AppText>
      ) : returning ? (
        <>
          <TextField
            label={t('s.committees.returnReason')}
            hint={t('s.committees.reasonHint')}
            value={reason}
            maxLength={500}
            onChangeText={setReason}
            error={showError && short ? t('s.committees.reasonRequired') : null}
          />
          {run.error ? <Notice tone="error">{committeeErrorMessage(t, run.error)}</Notice> : null}
          <Button
            variant="danger"
            label={t('s.committees.return')}
            busy={run.busy}
            onPress={() => {
              if (short) {
                setShowError(true);
                return;
              }
              void run.run(false);
            }}
          />
          <Button variant="quiet" label={t('s.common.cancel')} onPress={() => setReturning(false)} />
        </>
      ) : (
        <>
          {run.error ? <Notice tone="error">{committeeErrorMessage(t, run.error)}</Notice> : null}
          <Button
            icon="checkmark-circle-outline"
            label={t('s.committees.approvePublish')}
            busy={run.busy}
            onPress={() => void run.run(true)}
          />
          <Button variant="secondary" label={t('s.committees.return')} onPress={() => setReturning(true)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  entry: { gap: spacing[2], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.divider },
});
