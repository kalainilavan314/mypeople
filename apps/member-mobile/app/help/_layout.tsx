import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';

/**
 * Pages anyone can open, signed in or not: the root layout guards only the (member) and (auth)
 * groups. The public Community Support form lives here (https://app.tmk.lk/help/support).
 */
export default function HelpLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="support" options={{ title: t('m.support.requestTitle') }} />
    </Stack>
  );
}
