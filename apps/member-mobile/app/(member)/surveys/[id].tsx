import type { SurveyDetail } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatDateTime, Notice, Screen, useApiQuery, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { SurveyForm } from '@/features/surveys/SurveyForm';
import { api } from '@/lib/api';

/**
 * H14 Survey. While it can be answered the form opens (with the earlier answers when changes are
 * allowed); once answered without changes allowed, or once it closed, the receipt shows instead
 * (FR-SRV-005).
 */
export default function SurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const survey = useApiQuery(() => api().getSurvey(id), [id]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="surveys" query={survey}>
        {(data) => (data.canAnswer ? <SurveyForm survey={data} /> : <SurveyAnswered survey={data} />)}
      </FeatureQueryView>
    </Screen>
  );
}

function SurveyAnswered({ survey }: { survey: SurveyDetail }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  if (!survey.receipt) return <Notice tone="info">{t('m.surveys.closedBody')}</Notice>;
  return (
    <ReceiptCard
      title={t('m.surveys.answeredTitle')}
      referenceLabel={t('m.surveys.receiptNumber')}
      reference={survey.receipt.receiptRef}
      body={survey.state === 'open' ? t('m.surveys.noChanges') : t('m.surveys.closedAnswered')}>
      <DetailRow label={t('m.surveys.surveyName')} value={localized(survey.titleEn, survey.titleTa)} />
      <DetailRow label={t('m.surveys.sentOn')} value={formatDateTime(survey.receipt.updatedAt, language)} />
      <DetailRow label={t('m.surveys.whatNext')} value={localized(survey.nextStepsEn, survey.nextStepsTa)} />
    </ReceiptCard>
  );
}
