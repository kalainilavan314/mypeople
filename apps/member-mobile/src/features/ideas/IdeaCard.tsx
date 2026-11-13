import type { Idea } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDate,
  Notice,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useLanguage,
  type Tone,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** The state pill's colour; the words are My Activity's (m.profile.activityState_idea_*). */
const STATE_TONES: Record<Idea['state'], Tone> = {
  pending: 'pending',
  published: 'verified',
  rejected: 'error',
  withdrawn: 'neutral',
};

/**
 * One community idea (H13). Others' published ideas can be supported, once per member; the count
 * is shown, but support never approves anything (FR-IDEA-004). The author sees the moderation
 * state, the moderator's reason when it was not published, and can withdraw it.
 */
export function IdeaCard({ idea, onChanged }: { idea: Idea; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const support = useApiAction(async () => {
    await api().setIdeaSupport(idea.id, !idea.supported);
    onChanged();
  });
  const withdraw = useApiAction(async () => {
    const yes = await confirmAction({
      title: t('m.ideas.withdrawTitle'),
      message: t('m.ideas.withdrawBody'),
      confirmLabel: t('m.ideas.withdraw'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!yes) return;
    await api().withdrawIdea(idea.id);
    onChanged();
  });
  const error = support.error ?? withdraw.error;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{idea.title}</AppText>
      <AppText step="body" tone="secondary">
        {idea.benefit}
      </AppText>
      <View style={styles.tags}>
        {idea.mine ? <StatusTag tone={STATE_TONES[idea.state]} label={t(`m.profile.activityState_idea_${idea.state}`)} /> : null}
        {idea.mine ? <StatusTag tone="neutral" label={t('m.ideas.yourIdea')} /> : null}
      </View>
      {idea.mine ? (
        <AppText step="secondary" tone="muted" mono>
          {idea.ideaRef}
        </AppText>
      ) : null}
      {idea.mine && idea.state === 'rejected' && idea.moderationReason ? (
        <DetailRow label={t('m.ideas.moderatorReason')} value={idea.moderationReason} />
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.ideas.postedOn', { date: formatDate(idea.createdAt, language) })}
      </AppText>
      {idea.state === 'published' ? (
        <AppText step="secondary" tone="secondary">
          {t('m.ideas.supporters', { count: idea.supports })}
        </AppText>
      ) : null}
      {error ? <Notice tone="error">{errorMessage(t, error, 'ideas')}</Notice> : null}
      {idea.state === 'published' && !idea.mine ? (
        <Button
          label={idea.supported ? t('m.ideas.removeSupport') : t('m.ideas.support')}
          variant="secondary"
          icon={idea.supported ? 'heart' : 'heart-outline'}
          busy={support.busy}
          accessibilityHint={t('m.ideas.supportHint')}
          onPress={() => void support.run()}
        />
      ) : null}
      {idea.mine && (idea.state === 'pending' || idea.state === 'published') ? (
        <Button
          label={t('m.ideas.withdraw')}
          variant="quiet"
          busy={withdraw.busy}
          onPress={() => void withdraw.run()}
        />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
