import { ApiError, type MemberCard } from '@my-people/api-client';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  MenuRow,
  formatDateTime,
  Notice,
  Screen,
  SurfaceCard,
  clearOfflineCard,
  readOfflineCard,
  saveOfflineCard,
  type OfflineCardPreview,
  useApiQuery,
  useLanguage,
  useMember,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { OfflineCard } from '@/features/membership/OfflineCard';
import { CARD_WIDTH, MemberIdCard } from '@/features/membership/card/MemberIdCard';
import { useLiveCardCode } from '@/features/membership/card/useLiveCardCode';
import { api } from '@/lib/api';
import { errorMessage, noAnswer } from '@/lib/errors';

/** While offline the card asks the server again this often (FR-CARD-009). */
const OFFLINE_RETRY_MS = 30_000;

/**
 * C01 to C06: the membership card, only while identity is Verified and
 * membership Active (BR-065); otherwise why not and what comes next. It never
 * shows the NIC or passport number; the QR is a 60-second opaque code.
 *
 * C03: when the server cannot answer (no connection, or a server failure), this member's card
 * as last confirmed online is shown without a QR, and the screen keeps asking every 30 seconds.
 */
export default function CardScreen() {
  const { t } = useTranslation();
  const member = useMember();
  const [offline, setOffline] = useState<OfflineCardPreview | null>(null);
  const card = useApiQuery(async () => {
    const current = await api().getMyCard();
    try {
      if (current.available) await saveOfflineCard(member.id, current);
      else await clearOfflineCard();
    } catch {
      // A storage failure must not hide a card the server just confirmed.
    }
    return current;
  }, [member.id]);
  useReloadOnFocus(card.reload);
  const unanswered = card.error !== null && card.error !== undefined && noAnswer(card.error);
  useEffect(() => {
    if (!unanswered) return;
    const timer = setInterval(card.reload, OFFLINE_RETRY_MS);
    return () => clearInterval(timer);
  }, [unanswered, card.reload]);
  useEffect(() => {
    if (!unanswered) return;
    let active = true;
    void readOfflineCard().then((saved) => {
      if (active) setOffline(saved?.memberId === member.id ? saved : null);
    });
    return () => { active = false; };
  }, [unanswered, member.id]);
  return (
    <Screen title={t('m.card.title')} edges={[]} maxContentWidth={640} onRefresh={card.reload} refreshing={card.loading && card.data !== undefined}>
      {unanswered && offline ? (
        <>
          <OfflineCard preview={offline} />
          <Button label={t('m.common.retry')} variant="secondary" onPress={card.reload} />
        </>
      ) : card.error ? (
        <>
          <Notice tone="error">{errorMessage(t, card.error)}</Notice>
          <Button label={t('m.common.retry')} variant="secondary" onPress={card.reload} />
        </>
      ) : <QueryView query={card}>{(data) => (data.available ? <AvailableCard card={data} /> : <Unavailable card={data} />)}</QueryView>}
    </Screen>
  );
}

/**
 * The card as the owner designed it (17 November 2026), with the member's own photo and drawn
 * signature and the live QR. The QR is fetched only while this tab is on screen.
 */
function AvailableCard({ card }: { card: MemberCard }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const qrCode = useLiveCardCode(focused);

  return (
    <>
      <View onLayout={(event) => setWidth(Math.min(event.nativeEvent.layout.width, CARD_WIDTH))} style={styles.cardSlot}>
        {width > 0 ? (
          <MemberIdCard
            card={card}
            width={width}
            qrCode={qrCode}
            onPhotoPress={() => router.push('/card/photo' as Href)}
            onSignPress={() => router.push('/card/sign' as Href)}
          />
        ) : null}
      </View>
      <AppText step="caption" tone="muted" style={styles.center}>{t('m.card.cardEditHint')}</AppText>

      <Button label={t('m.card.showCode')} icon="qr-code-outline" onPress={() => router.push('/card/code')} />
      <Button label={t('m.card.fullScreen')} icon="expand-outline" variant="secondary" onPress={() => router.push('/card/full' as Href)} />
      <AppText step="section" accessibilityRole="header">{t('m.card.optionsTitle')}</AppText>
      <SurfaceCard style={styles.actionList}>
        <MenuRow first icon="image-outline" label={t('m.card.cardPhotoRow')} onPress={() => router.push('/card/photo' as Href)} />
        <MenuRow icon="create-outline" label={t('m.card.signatureRow')} onPress={() => router.push('/card/sign' as Href)} />
        <MenuRow icon="time-outline" label={t('m.card.progressTitle')} onPress={() => router.push('/card/progress')} />
        <MenuRow icon="share-outline" label={t('m.card.shareTitle')} onPress={() => router.push('/card/share' as Href)} />
      </SurfaceCard>

      {card.lastScannedAt ? (
        <AppText step="secondary" tone="muted">{`${t('m.card.lastScan')}: ${formatDateTime(card.lastScannedAt, language)}`}</AppText>
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.card.noIdNumbers')}
      </AppText>
    </>
  );
}

/** C06: why the card is not shown yet, as three steps with their own state, and where to look. */
function Unavailable({ card }: { card: MemberCard }) {
  const { t } = useTranslation();
  const membershipPending = card.membershipState === 'pending';
  const reason = !card.identityVerified ? 'notActiveBody' : `unavailable_membership_${card.membershipState}`;
  const steps = [
    {
      label: t('m.card.stepIdentity'),
      state: card.identityVerified ? t('m.card.identityVerified') : t('m.verify.status_in_review'),
      done: card.identityVerified,
    },
    {
      label: t('m.card.stepMembership'),
      state: membershipPending ? t('m.card.membershipAwaiting') : t(`m.home.membership_${card.membershipState}`),
      done: card.membershipState === 'active',
    },
    { label: t('m.card.stepCard'), state: t('m.card.cardWhenActive'), done: false },
  ];
  return (
    <View style={styles.unavailable}>
      <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no">
        <Ionicons name="card-outline" size={40} color={colors.warningText} />
      </View>
      <AppText step="title" style={styles.center} accessibilityRole="header">
        {t('m.card.notActiveTitle')}
      </AppText>
      <AppText step="body" tone="muted" style={styles.center}>
        {t(`m.card.${reason}`, { defaultValue: t('m.errors.card_not_available') })}
      </AppText>
      <SurfaceCard style={styles.steps}>
        {steps.map((step) => (
          <View key={step.label} style={styles.step} accessible accessibilityLabel={`${step.label}: ${step.state}`}>
            <Ionicons name={step.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={step.done ? colors.success : colors.inputBorder} />
            <View style={styles.flex}>
              <AppText step="card" weight={400}>{step.label}</AppText>
              <AppText step="secondary" tone="muted">{step.state}</AppText>
            </View>
          </View>
        ))}
      </SurfaceCard>
      <Button label={t('m.card.viewStatus')} onPress={() => router.push('/verify')} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardSlot: {
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  unavailable: { gap: spacing[4], paddingTop: spacing[6] },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningBackground,
  },
  center: { textAlign: 'center' },
  steps: { gap: spacing[4], paddingVertical: spacing[5] },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  flex: { flex: 1 },
  actionList: { paddingVertical: 0, gap: 0 },
});
