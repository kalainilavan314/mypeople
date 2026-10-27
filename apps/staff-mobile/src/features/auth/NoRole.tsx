import { useTranslation } from 'react-i18next';

import { Button, Notice, Screen, useSession } from '@my-people/mobile-ui';

/** S01: an account with no staff role that counts now is told why, never shown staff screens. */
export function NoRole() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <Screen edges={['top', 'bottom']} title={t('s.noRole.title')}>
      <Notice tone="warning">{t('s.noRole.body')}</Notice>
      <Button label={t('s.common.signOut')} variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
