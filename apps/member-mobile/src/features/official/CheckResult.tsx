import type { OfficialCheck } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { AppText, Notice } from '@my-people/mobile-ui';

import { OfficialStatementView } from './OfficialStatementView';

/**
 * FR-AUT-005: what checking a code says. Verified and withdrawn records show the signed statement
 * to compare with; anything else is "No matching official record" and shows nothing as official.
 */
export function CheckResult({ result }: { result: OfficialCheck }) {
  const { t } = useTranslation();
  const code = result.checkCode ? (
    <AppText step="secondary" tone="muted" mono>
      {t('m.official.codeChecked', { code: result.checkCode })}
    </AppText>
  ) : null;

  if (result.status === 'verified' && result.statement) {
    return (
      <>
        <Notice tone="success" title={t('m.official.verifiedTitle')}>
          {t('m.official.verifiedBody')}
        </Notice>
        {code}
        <OfficialStatementView statement={result.statement} />
      </>
    );
  }
  if (result.status === 'withdrawn' && result.statement) {
    // The statement view itself leads with "Withdrawn", the date and the reason.
    return (
      <>
        {code}
        <OfficialStatementView statement={result.statement} />
      </>
    );
  }
  if (result.problem === 'signature_invalid') {
    return (
      <>
        <Notice tone="error" title={t('m.official.signatureInvalidTitle')}>
          {t('m.official.signatureInvalidBody')}
        </Notice>
        {code}
      </>
    );
  }
  return (
    <>
      <Notice tone="error" title={t('m.official.noMatchTitle')}>
        {result.checkCode ? t('m.official.noMatchBody') : t('m.official.noCodeBody')}
      </Notice>
      {code}
    </>
  );
}
