import { useTranslation } from 'react-i18next';

import { Notice } from '@my-people/mobile-ui';

/**
 * FR-PBG-009, BR-123: every cycle is labelled a party or community consultation, never a public
 * election or a government budget decision, and the label is visible before voting.
 */
export function ConsultationNotice() {
  const { t } = useTranslation();
  return (
    <Notice tone="info" title={t('m.budgeting.consultationTitle')}>
      {t('m.budgeting.consultationBody')}
    </Notice>
  );
}
