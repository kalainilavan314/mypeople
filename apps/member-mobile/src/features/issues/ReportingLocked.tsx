import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice } from '@my-people/mobile-ui';

/**
 * Only Verified and Active members report (FR-RPT-017, BR-026). The reason is the server's; the
 * button opens the screen that can change it.
 */
export function ReportingLocked({ reason }: { reason: string | null }) {
  const { t } = useTranslation();
  const identity = reason === 'identity_not_verified';
  const membership = reason === 'membership_not_active';
  return (
    <Notice tone="warning" title={t('m.issues.lockedTitle')}>
      <AppText step="secondary" tone="warning">
        {identity || membership ? t(`m.issues.locked_${reason}`) : t('m.issues.lockedOther')}
      </AppText>
      {identity ? (
        <Button label={t('m.issues.openVerification')} variant="secondary" icon="shield-checkmark-outline" onPress={() => router.push('/verify')} />
      ) : null}
      {membership ? (
        <Button label={t('m.issues.openCard')} variant="secondary" icon="card-outline" onPress={() => router.push('/card')} />
      ) : null}
    </Notice>
  );
}
