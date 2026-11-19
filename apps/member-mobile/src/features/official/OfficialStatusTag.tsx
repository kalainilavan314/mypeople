import type { OfficialStatement } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { StatusTag } from '@my-people/mobile-ui';

/**
 * "Official statement" only on content whose signature verifies (BR-148, FR-AUT-003). A withdrawn
 * statement says so instead, and one whose signature fails is never shown as official.
 */
export function OfficialStatusTag({ state, signed }: { state: OfficialStatement['state']; signed: boolean }) {
  const { t } = useTranslation();
  if (!signed) return <StatusTag tone="error" label={t('m.official.notVerifiedLabel')} />;
  if (state === 'withdrawn') return <StatusTag tone="neutral" label={t('m.official.withdrawnLabel')} />;
  return <StatusTag tone="verified" label={t('m.official.officialLabel')} />;
}
