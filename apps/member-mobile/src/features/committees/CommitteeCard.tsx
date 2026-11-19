import type { CommitteeCard as Card } from '@my-people/api-client';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, spacing } from '@my-people/design-tokens/mobile';
import { AppText, IconTile, StatusTag, SurfaceCard, useLocalized } from '@my-people/mobile-ui';

import { STATE_TONES, wingIcon } from './labels';

/** One approved committee in M31: its wing, name, size and the member's own state; opens M32. */
export function CommitteeCard({ committee }: { committee: Card }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const name = localized(committee.nameEn, committee.nameTa);
  const wing = committee.wingNameEn
    ? localized(committee.wingNameEn, committee.wingNameTa ?? '')
    : t(`m.committees.wing_${committee.wingType}`);
  const membership = committee.myMembership;
  const state = membership
    ? membership.state === 'approved' && membership.role
      ? t(`m.committees.role_${membership.role}`)
      : t(`m.committees.state_${membership.state}`)
    : null;

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/committees/[id]', params: { id: committee.id } })}
      accessibilityLabel={[name, wing, t('m.committees.members', { count: committee.members }), state]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t('m.committees.opensCommittee')}>
      <View style={styles.row}>
        <IconTile icon={wingIcon(committee.wingType)} tint="brand" size={40} />
        <View style={styles.text}>
          <AppText step="card">{name}</AppText>
          <AppText step="secondary" tone="secondary">
            {wing}
          </AppText>
          <AppText step="caption" tone="muted">
            {t('m.committees.members', { count: committee.members })}
          </AppText>
        </View>
        <Ionicons
          accessible={false}
          name="chevron-forward"
          size={iconSize.row}
          color={colors.textMuted}
          style={styles.arrow}
        />
      </View>
      {membership && state ? <StatusTag tone={STATE_TONES[membership.state]} label={state} /> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
  arrow: { flexShrink: 0 },
});
