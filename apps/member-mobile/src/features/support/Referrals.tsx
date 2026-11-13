import type { MySupportReferral } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, formatDate, Notice, StatusTag, SurfaceCard, useApiAction, useLanguage } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { REFERRAL_TONES } from './labels';

type Props = { caseId: string; referrals: MySupportReferral[]; onAnswered: () => void };

/**
 * M12: consent again for each partner referral. The caseworker proposes an organisation and says why;
 * nothing about the request reaches that organisation unless the applicant agrees here (FR-AST-004).
 */
export function Referrals({ caseId, referrals, onAnswered }: Props) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.support.referralsTitle')}
      </AppText>
      {referrals.map((referral, index) => (
        <View key={referral.id} style={[styles.entry, index > 0 && styles.divider]}>
          <AppText step="card">{referral.partner}</AppText>
          <AppText step="secondary" tone="secondary">
            {t(`m.support.partnerKind_${referral.partnerKind}`)}
          </AppText>
          <StatusTag tone={REFERRAL_TONES[referral.state]} label={t(`m.support.referralState_${referral.state}`)} />
          {referral.purpose ? <DetailRow label={t('m.support.referralPurpose')} value={referral.purpose} /> : null}
          {referral.consentAt ? (
            <AppText step="caption" tone="muted">
              {t('m.support.referralAgreedOn', { date: formatDate(referral.consentAt, language) })}
            </AppText>
          ) : null}
          {referral.state === 'proposed' ? <Answer caseId={caseId} referral={referral} onAnswered={onAnswered} /> : null}
        </View>
      ))}
    </SurfaceCard>
  );
}

function Answer({ caseId, referral, onAnswered }: { caseId: string; referral: MySupportReferral; onAnswered: () => void }) {
  const { t } = useTranslation();
  const answer = useApiAction(async (consent: boolean) => {
    await api().answerSupportReferral(caseId, referral.id, consent);
    onAnswered();
  });
  return (
    <View style={styles.answer}>
      <AppText step="secondary" tone="secondary">
        {t('m.support.referralQuestion', { partner: referral.partner })}
      </AppText>
      {answer.error ? <Notice tone="error">{errorMessage(t, answer.error, 'support')}</Notice> : null}
      <Button
        label={t('m.support.referralAccept')}
        icon="checkmark"
        busy={answer.busy}
        disabled={answer.busy}
        onPress={() => void answer.run(true)}
      />
      <Button
        label={t('m.support.referralDecline')}
        variant="secondary"
        disabled={answer.busy}
        onPress={() => void answer.run(false)}
      />
      <AppText step="caption" tone="muted">
        {t('m.support.referralDeclineNote')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  entry: { gap: spacing[1] },
  answer: { gap: spacing[2], marginTop: spacing[2] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
});
