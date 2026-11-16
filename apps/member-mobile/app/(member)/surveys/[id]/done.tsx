import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice, Screen, useApiQuery, useLocalized } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { api } from '@/lib/api';

function backToSurveys() {
  if (router.canGoBack()) router.back();
  else router.replace('/surveys');
}

/**
 * H21 Survey sent: the survey's name, the receipt number from the server and what happens next.
 * The receipt is also in My Activity.
 */
export default function SurveyDoneScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { id } = useLocalSearchParams<{ id: string }>();
  const survey = useApiQuery(() => api().getSurvey(id), [id]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="surveys" query={survey}>
        {(data) =>
          data.receipt ? (
            <ReceiptCard
              title={t('m.surveys.doneTitle')}
              referenceLabel={t('m.surveys.receiptNumber')}
              reference={data.receipt.receiptRef}>
              <DetailRow label={t('m.surveys.surveyName')} value={localized(data.titleEn, data.titleTa)} />
              <DetailRow label={t('m.surveys.whatNext')} value={localized(data.nextStepsEn, data.nextStepsTa)} />
              <AppText step="secondary" tone="secondary">
                {t('m.surveys.inActivity')}
              </AppText>
              <Button label={t('m.surveys.allSurveys')} icon="list-outline" onPress={backToSurveys} />
              <Button
                label={t('m.profile.myActivity')}
                variant="secondary"
                icon="time-outline"
                onPress={() => router.push('/profile/activity')}
              />
            </ReceiptCard>
          ) : (
            <Notice tone="warning">{t('m.surveys.noReceipt')}</Notice>
          )
        }
      </FeatureQueryView>
    </Screen>
  );
}
