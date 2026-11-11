import Ionicons from '@expo/vector-icons/Ionicons';
import type { MemberCard } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  formatDate,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
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
    <Screen edges={[]} onRefresh={card.reload} refreshing={card.loading && card.data !== undefined}>
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

function Field({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <AppText step="caption" tone="inverse" style={styles.fieldLabel}>
        {label}
      </AppText>
      <AppText step="body" tone="inverse" mono={mono}>
        {value}
      </AppText>
    </View>
  );
}

function AvailableCard({ card }: { card: MemberCard }) {
  const { t } = useTranslation();
  const language = useLanguage();

  return (
    <>
      <View style={styles.card} accessible accessibilityLabel={`${t('m.card.title')}, ${card.displayName}, ${card.memberCode}`}>
        <View style={styles.cardHeader}>
          <AppText step="label" tone="inverse">
            என் மக்கள் · My People
          </AppText>
          <AppText step="caption" tone="inverse" style={styles.fieldLabel}>
            {card.designation ? t('m.card.tier', { tier: card.designation }) : t('m.card.member')}
          </AppText>
        </View>
        <AppText step="page" tone="inverse">
          {card.displayName}
        </AppText>
        <Field label={t('m.card.memberId')} value={card.memberCode} mono />
        <View style={styles.row}>
          <Field label={t('m.card.district')} value={card.districtName} />
          <Field label={t('m.card.gn')} value={card.gnName} />
        </View>
        <Field label={t('m.card.since')} value={card.memberSince ? formatDate(card.memberSince, language) : null} />
        <View style={styles.verified}>
          <StatusTag tone="verified" label={t('m.card.identityVerified')} />
          <StatusTag tone="verified" label={t('m.card.membershipActive')} />
        </View>
      </View>

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
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.sheet,
    padding: spacing[5],
    gap: spacing[3],
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  field: { gap: 2, flex: 1 },
  fieldLabel: { color: colors.inputBorder }, // #CBD5E1 on navy, the spec's metadata colour (§2)
  row: { flexDirection: 'row', gap: spacing[3] },
  verified: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
