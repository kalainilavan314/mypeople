import { useTranslation } from 'react-i18next';

import { Notice } from '@my-people/mobile-ui';

/** FR-DIS-003, OS-14: on every alert and on M36, in the member's language, with or without a connection. */
export function NotDispatchNotice() {
  const { t } = useTranslation();
  return (
    <Notice tone="warning" title={t('m.safety.notDispatchTitle')}>
      {t('m.safety.notDispatchBody')}
    </Notice>
  );
}
