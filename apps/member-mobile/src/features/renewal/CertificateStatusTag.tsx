import type { Certificate, CertificateStatus } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { AppText, StatusTag, type Tone } from '@my-people/mobile-ui';

const TONE: Record<CertificateStatus, Tone> = { valid: 'verified', revoked: 'error', superseded: 'neutral' };

/** Valid, withdrawn or replaced, in words and colour (never colour alone), with what replaced it. */
export function CertificateStatusTag({ certificate }: { certificate: Certificate }) {
  const { t } = useTranslation();
  return (
    <>
      <StatusTag tone={TONE[certificate.status]} label={t(`m.renewal.status_${certificate.status}`)} />
      {certificate.supersededByRef ? (
        <AppText step="secondary" tone="muted">
          {t('m.renewal.replacedBy', { ref: certificate.supersededByRef })}
        </AppText>
      ) : null}
      {certificate.status !== 'valid' && certificate.statusReason ? (
        <AppText step="secondary" tone="muted">
          {t('m.renewal.statusReason', { reason: certificate.statusReason })}
        </AppText>
      ) : null}
    </>
  );
}
