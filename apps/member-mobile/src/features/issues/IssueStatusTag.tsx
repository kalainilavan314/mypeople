import type { IssueStatus } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { StatusTag } from '@my-people/mobile-ui';

import { STATUS_TONES } from './labels';

/** The issue's status in words and colour, never colour alone (FR-RPT-003). */
export function IssueStatusTag({ status }: { status: IssueStatus }) {
  const { t } = useTranslation();
  return <StatusTag tone={STATUS_TONES[status]} label={t(`m.issues.status_${status}`)} />;
}
