import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice } from '@my-people/mobile-ui';

/** My area and reporting both need the GN division on the profile; this says so and opens P05. */
export function NoAreaNotice() {
  const { t } = useTranslation();
  return (
    <Notice tone="warning" title={t('m.issues.noAreaTitle')}>
      <AppText step="secondary" tone="warning">
        {t('m.issues.noAreaBody')}
      </AppText>
      <Button label={t('m.issues.setArea')} variant="secondary" icon="location-outline" onPress={() => router.push('/profile/area')} />
    </Notice>
  );
}
