import type { ProposalStage } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { StatusTag } from '@my-people/mobile-ui';

import { STAGE_TONES } from './labels';

/** A proposal's stage in words and colour, the same words as in My Activity. */
export function StageTag({ stage }: { stage: ProposalStage }) {
  const { t } = useTranslation();
  return <StatusTag tone={STAGE_TONES[stage]} label={t(`m.profile.activityState_proposal_${stage}`)} />;
}
