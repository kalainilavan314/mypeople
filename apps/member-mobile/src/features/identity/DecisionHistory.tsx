import type { IdentityReview } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import { AppText, formatDate, StatusTag, SurfaceCard, useLanguage } from '@my-people/mobile-ui';

/** FR-PROF-006: each decision with the reviewer's level and date, never their name, and any appeal. */
export function DecisionHistory({ review }: { review: IdentityReview }) {
  const { t } = useTranslation();
  const language = useLanguage();
  if (review.history.length === 0) return null;
  return (
    <View style={styles.list}>
      <AppText step="section" accessibilityRole="header">
        {t('m.verify.history')}
      </AppText>
      <SurfaceCard style={styles.historyCard}>
      {review.history.map((decision, index) => (
        <View key={decision.decidedAt} style={[styles.decision, index > 0 && styles.divider]}>
          <AppText step="card">{t(`m.verify.decision_${decision.decision}`)}</AppText>
          <AppText step="secondary" tone="muted">
            {`${formatDate(decision.decidedAt, language)} · ${t('m.verify.byTier', { tier: decision.reviewerTier })}`}
          </AppText>
          {decision.note ? (
            <AppText step="secondary" tone="secondary">
              {decision.note}
            </AppText>
          ) : null}
          {decision.appeal ? (
            <View style={styles.appeal}>
              <StatusTag
                tone={decision.appeal.state === 'upheld' || decision.appeal.state === 'overturned' ? 'neutral' : 'pending'}
                label={t(`m.verify.appealState_${decision.appeal.state}`)}
              />
              {decision.appeal.outcomeReason ? (
                <AppText step="secondary" tone="secondary">
                  {decision.appeal.outcomeReason}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  historyCard: { padding: 0, gap: 0, overflow: 'hidden' },
  decision: { gap: spacing[2], padding: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  appeal: { gap: spacing[1] },
});
