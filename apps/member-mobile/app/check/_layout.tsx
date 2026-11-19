import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';

/**
 * The public check page a check link opens (https://app.tmk.lk/check/TMK-…, INT-22). Like help/, it is
 * outside the (member) and (auth) groups, so anyone can open it, signed in or not.
 */
export default function CheckLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="[code]" options={{ title: t('m.official.publicCheckTitle') }} />
    </Stack>
  );
}
