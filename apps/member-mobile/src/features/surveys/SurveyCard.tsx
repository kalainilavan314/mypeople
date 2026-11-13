import type { SurveySummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, IconTile, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

/**
 * One open survey: who it is for, when it closes, and the receipt once answered. "Anonymous" shows
 * only on surveys that are (FR-SRV-003); no other survey uses the word.
 */
export function SurveyCard({ survey }: { survey: SurveySummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(survey.titleEn, survey.titleTa);
  const audience = t('m.surveys.forAudience', { audience: localized(survey.audienceEn, survey.audienceTa) });
  const closes = survey.closesAt ? t('m.surveys.closesOn', { date: formatDate(survey.closesAt, language) }) : null;
  const answered = survey.receipt ? t('m.surveys.answeredReceipt', { receipt: survey.receipt.receiptRef }) : null;
  const spoken = [title, audience, survey.anonymous ? t('m.surveys.anonymous') : null, closes, answered].filter(Boolean).join('. ');

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/surveys/[id]', params: { id: survey.id } })}
      accessibilityLabel={spoken}
      accessibilityHint={t('m.surveys.opensSurvey')}>
      <View style={styles.row}>
        <IconTile icon="clipboard-outline" tint="purple" size={40} />
        <View style={styles.text}>
          <AppText step="card">{title}</AppText>
          <AppText step="secondary" tone="secondary">
            {audience}
          </AppText>
        </View>
      </View>
      {closes ? (
        <AppText step="caption" tone="muted">
          {closes}
        </AppText>
      ) : null}
      <View style={styles.tags}>
        {survey.anonymous ? <StatusTag tone="neutral" label={t('m.surveys.anonymous')} /> : null}
        {survey.receipt ? <StatusTag tone="verified" label={t('m.surveys.answered')} /> : null}
      </View>
      {survey.receipt ? (
        <AppText step="secondary" tone="muted" mono>
          {survey.receipt.receiptRef}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
