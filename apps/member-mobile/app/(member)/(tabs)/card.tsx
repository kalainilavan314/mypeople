import { ApiError, type MemberCard } from '@my-people/api-client';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  formatDate,
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
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * C01 to C06: the membership card, only while identity is Verified and
 * membership Active (BR-065); otherwise why not and what comes next. It never
 * shows the NIC or passport number; the QR is a 60-second opaque code.
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
  useEffect(() => {
    if (!card.error || card.error instanceof ApiError) return;
    let active = true;
    void readOfflineCard().then((saved) => {
      if (active) setOffline(saved?.memberId === member.id ? saved : null);
    });
    return () => { active = false; };
  }, [card.error, member.id]);
  return (
    <Screen edges={[]} maxContentWidth={640} onRefresh={card.reload} refreshing={card.loading && card.data !== undefined}>
      {card.error && !(card.error instanceof ApiError) && offline ? (
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
      <AppText step="caption" tone="inverse">
        {label}
      </AppText>
      <AppText step="body" tone="inverse" mono={mono}>
        {value}
      </AppText>
    </View>
  );
}

function CardAction({ label, icon, divided = false, onPress }: {
  label: string;
  icon: 'share-outline' | 'time-outline';
  divided?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, divided && styles.actionDivider, pressed && styles.actionPressed]}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <AppText step="label" style={styles.actionLabel}>{label}</AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
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
          <AppText step="caption" tone="inverse">
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
          <View style={styles.verifiedItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
            <AppText step="caption" tone="inverse">{t('m.card.identityVerified')}</AppText>
          </View>
          <View style={styles.verifiedItem}>
            <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
            <AppText step="caption" tone="inverse">{t('m.card.membershipActive')}</AppText>
          </View>
        </View>
      </View>

      <Button
        label={t('m.card.showCode')}
        icon="qr-code-outline"
        onPress={() => router.push('/card/code')}
      />
      <AppText step="section" accessibilityRole="header">{t('m.card.optionsTitle')}</AppText>
      <SurfaceCard style={styles.actionList}>
        <CardAction label={t('m.card.progressTitle')} icon="time-outline" onPress={() => router.push('/card/progress')} />
        <CardAction label={t('m.card.shareTitle')} icon="share-outline" divided onPress={() => router.push('/card/share' as Href)} />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  field: { gap: 2, flex: 1 },
  row: { flexDirection: 'row', gap: spacing[3] },
  verified: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  verifiedItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  actionList: { padding: 0, gap: 0, overflow: 'hidden' },
  action: { minHeight: control.touchMin + spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  actionDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  actionPressed: { backgroundColor: colors.surfaceVariant },
  actionLabel: { flex: 1 },
});
