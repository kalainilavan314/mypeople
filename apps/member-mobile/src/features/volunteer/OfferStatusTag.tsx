import type { VolunteerOfferState } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import { StatusTag } from '@my-people/mobile-ui';

import { OFFER_TONES } from './labels';

/** An offer's state in words and colour, the same words as in My Activity. */
export function OfferStatusTag({ state }: { state: VolunteerOfferState }) {
  const { t } = useTranslation();
  return <StatusTag tone={OFFER_TONES[state]} label={t(`m.profile.activityState_volunteer_offer_${state}`)} />;
}
