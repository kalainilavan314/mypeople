import { useTranslation } from 'react-i18next';

import { Button, Notice, Screen } from '@my-people/mobile-ui';

import { leaveStaffSection } from '@/features/staff/LeaveStaffButton';

/** S01: an account with no staff role that counts now is told why, never shown staff screens. */
export function NoRole() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top', 'bottom']} title={t('s.noRole.title')}>
      <Notice tone="warning">{t('s.noRole.body')}</Notice>
      <Button label={t('s.common.backToApp')} variant="secondary" icon="arrow-back" onPress={leaveStaffSection} />
    </Screen>
  );
}
