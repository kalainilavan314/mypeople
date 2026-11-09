import type { MemberCard } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { MemberCardView } from '@/features/membership/MemberCardView';
import { OfflineCard } from '@/features/membership/OfflineCard';
import { loadSavedCard, rememberCard, type SavedCard } from '@/features/membership/savedCard';
import { api } from '@/lib/api';
import { noAnswer } from '@/lib/errors';

/** While offline the card asks the server again this often (FR-CARD-009). */
const OFFLINE_RETRY_MS = 30_000;

/**
 * C01 to C06: the membership card, only while identity is Verified and
 * membership Active (BR-065); otherwise why not and what comes next. It never
 * shows the NIC or passport number; the QR is a 60-second opaque code.
 *
 * C03: when the server cannot be reached, the card last confirmed online is
 * shown with its time and without a QR code, and the screen keeps trying; the
 * live card returns as soon as an answer arrives.
 */
export default function CardScreen() {
  const card = useApiQuery(async () => {
    const loaded = await api().getMyCard();
    await rememberCard(loaded);
    return loaded;
  });
  useReloadOnFocus(card.reload);
  const offline = !card.loading && card.error !== null && noAnswer(card.error);
  const [saved, setSaved] = useState<SavedCard | null>(null);

  useEffect(() => {
    if (!offline) return;
    let active = true;
    void loadSavedCard().then((found) => active && setSaved(found));
    const timer = setInterval(card.reload, OFFLINE_RETRY_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [offline, card.reload]);

  return (
    <Screen edges={[]} onRefresh={card.reload} refreshing={card.loading && card.data !== undefined}>
      {offline && saved ? (
        <OfflineCard saved={saved} onRetry={card.reload} retrying={card.loading} />
      ) : (
        <QueryView query={card}>{(data) => (data.available ? <AvailableCard card={data} /> : <Unavailable card={data} />)}</QueryView>
      )}
    </Screen>
  );
}

function AvailableCard({ card }: { card: MemberCard }) {
  const { t } = useTranslation();
  const language = useLanguage();

  return (
    <>
      <MemberCardView card={card} />

      <Button
        label={t('m.card.showCode')}
        icon="qr-code-outline"
        onPress={() => router.push('/card/code')}
      />
      <Button label={t('m.card.progressTitle')} variant="secondary" onPress={() => router.push('/card/progress')} />
      <Button label={t('m.card.shareTitle')} variant="secondary" onPress={() => router.push('/card/share' as Href)} />

      {card.lastScannedAt ? (
        <AppText step="secondary" tone="muted">{`${t('m.card.lastScan')}: ${formatDateTime(card.lastScannedAt, language)}`}</AppText>
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.card.noIdNumbers')}
      </AppText>
    </>
  );
}

function Unavailable({ card }: { card: MemberCard }) {
  const { t } = useTranslation();
  const reason = !card.identityVerified ? 'unavailable_identity' : `unavailable_membership_${card.membershipState}`;
  return (
    <>
      <Notice tone="warning" title={t('m.card.unavailableTitle')}>
        {t(`m.card.${reason}`, { defaultValue: t('m.errors.card_not_available') })}
      </Notice>
      {!card.identityVerified ? (
        <Button label={t('m.home.viewVerification')} onPress={() => router.push('/verify')} />
      ) : null}
    </>
  );
}
