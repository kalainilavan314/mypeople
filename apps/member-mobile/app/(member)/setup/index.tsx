import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen, StatusTag, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** A18: returning people see server-derived progress and continue at their first incomplete step. */
export default function SetupScreen() {
  const { t } = useTranslation();
  const progress = useApiQuery(() => api().getMyRegistrationProgress());
  return <Screen edges={['bottom']} title={t('m.setup.title')} subtitle={t('m.setup.subtitle')}><QueryView query={progress}>{(data) => <>
    {data.steps.map((step) => <SurfaceCard key={step.name}><StatusTag tone={step.done ? 'verified' : 'pending'} label={t(step.done ? 'm.setup.complete' : 'm.setup.pending')} /><AppText step="body">{t(`m.setup.step_${step.name}`)}</AppText></SurfaceCard>)}
    <Button label={t('m.setup.continue')} disabled={!data.nextStep} onPress={() => router.replace('/verify')} />
    <Button label={t('m.setup.surveyTitle')} variant="secondary" onPress={() => router.push('/setup/survey')} />
  </>}</QueryView></Screen>;
}
