import { ApiError } from '@my-people/api-client';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@my-people/mobile-ui';

/** Sync refusals the staff member can resolve on the Registered phones screen. */
const FIXED_THERE = new Set(['active_device_limit_reached', 'device_not_registered']);

/** Shown under a failed sync: a way to the screen that resolves it, when one does. */
export function RegisteredPhonesLink({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!(error instanceof ApiError) || !FIXED_THERE.has(error.code)) return null;
  return (
    <Button label={t('s.devices.open')} variant="secondary" icon="cloud-offline-outline" onPress={() => router.push('/devices')} />
  );
}
