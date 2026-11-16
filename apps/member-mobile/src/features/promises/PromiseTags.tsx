import type { PromiseKind, PromiseStatus } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { StatusTag } from '@my-people/mobile-ui';

import { STATUS_TONES } from './labels';

/** A promise's status in words and colour, never colour alone. */
export function PromiseStatusTag({ status }: { status: PromiseStatus }) {
  const { t } = useTranslation();
  return <StatusTag tone={STATUS_TONES[status]} label={t(`m.promises.status_${status}`)} />;
}

/** "Party commitment" or "Government responsibility", shown on every promise (FR-PRM-004). */
export function PromiseKindTag({ kind }: { kind: PromiseKind }) {
  const { t } = useTranslation();
  return <StatusTag tone="neutral" label={t(`m.promises.kind_${kind}`)} />;
}
