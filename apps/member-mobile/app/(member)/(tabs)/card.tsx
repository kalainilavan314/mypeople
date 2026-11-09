import type { MemberCard } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  formatDate,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/**
 * C01 to C06: the membership card, only while identity is Verified and
 * membership Active (BR-065); otherwise why not and what comes next. It never
 * shows the NIC or passport number; the QR is a 60-second opaque code.
 */
export default function CardScreen() {
  const card = useApiQuery(() => api().getMyCard());
  useReloadOnFocus(card.reload);
  return (
    <Screen edges={[]} onRefresh={card.reload} refreshing={card.loading && card.data !== undefined}>
      <QueryView query={card}>{(data) => (data.available ? <AvailableCard card={data} /> : <Unavailable card={data} />)}</QueryView>
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
  fieldLabel: { color: colors.inputBorder }, // #CBD5E1 on navy, the spec's metadata colour (§2)
  row: { flexDirection: 'row', gap: spacing[3] },
  verified: { flexDirection: 'row' },
});
