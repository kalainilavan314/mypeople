import type { MemberCard } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';

import { AppText, formatDate, StatusTag, useLanguage } from '@my-people/mobile-ui';

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

/**
 * The navy card itself: name, member ID, area and since when. It never shows
 * the NIC or passport number (FR-CARD-002). Offline, the "Identity verified"
 * tag gives way to "Online check needed", because a saved copy proves nothing
 * on its own (BR-066).
 */
export function MemberCardView({ card, offline = false }: { card: MemberCard; offline?: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <View style={styles.card} accessible accessibilityLabel={`${t('m.card.title')}, ${card.displayName ?? ''}, ${card.memberCode ?? ''}`}>
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
      <View style={styles.tag}>
        {offline ? (
          <StatusTag tone="pending" label={t('m.card.onlineCheckNeeded')} />
        ) : (
          <StatusTag tone="verified" label={t('m.card.identityVerified')} />
        )}
      </View>
    </View>
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
  tag: { flexDirection: 'row' },
});
