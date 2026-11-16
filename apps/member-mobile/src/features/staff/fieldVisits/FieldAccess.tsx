import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice, Screen } from '@my-people/mobile-ui';

import { useStaff } from '@/providers/StaffProvider';

import { FIELD_COLLECT } from './concerns';

/** The field-visit screens open only for a role with field.collect; the API checks it again. */
export function FieldAccess({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  if (permissions.has(FIELD_COLLECT)) return <>{children}</>;
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <Notice tone="info">{t('s.fieldVisits.noAccess')}</Notice>
    </Screen>
  );
}
