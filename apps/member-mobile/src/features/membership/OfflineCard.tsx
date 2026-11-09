import { useTranslation } from 'react-i18next';

import { AppText, Button, formatDateTime, Notice, useLanguage } from '@my-people/mobile-ui';

import { MemberCardView } from './MemberCardView';
import type { SavedCard } from './savedCard';

type Props = {
  saved: SavedCard;
  /** Tries the server again; left out where the screen has its own retry. */
  onRetry?: () => void;
  retrying?: boolean;
};

/**
 * C03: the card as last confirmed online, labelled with that time. No QR
 * code is shown, since codes are never stored on the phone and a saved copy
 * cannot prove membership (FR-CARD-008, BR-066).
 */
export function OfflineCard({ saved, onRetry, retrying = false }: Props) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <>
      <Notice tone="warning" title={t('m.card.offlineTitle', { time: formatDateTime(saved.savedAt, language) })}>
        {t('m.card.offlineBody')}
      </Notice>
      <MemberCardView card={saved.card} offline />
      {onRetry ? (
        <Button label={t('m.common.retry')} icon="refresh" variant="secondary" busy={retrying} busyLabel={t('m.common.loading')} onPress={onRetry} />
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.card.noIdNumbers')}
      </AppText>
    </>
  );
}
