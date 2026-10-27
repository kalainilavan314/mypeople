import type { IdentityReview } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

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
      {review.history.map((decision) => (
        <SurfaceCard key={decision.decidedAt}>
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
        </SurfaceCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  appeal: { gap: spacing[1] },
});
