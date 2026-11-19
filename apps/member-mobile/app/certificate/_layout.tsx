import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';

/**
 * The public certificate check (INT-22, FR-RNW-007): the address a certificate's QR carries
 * (https://app.tmk.lk/certificate/<code>). Anyone can open it, signed in or not: the root layout
 * guards only the (member) and (auth) groups.
 */
export default function CertificateCheckLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="[token]" options={{ title: t('m.renewal.checkTitle') }} />
    </Stack>
  );
}
