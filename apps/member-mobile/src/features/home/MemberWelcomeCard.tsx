import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, IconTile, StatusTag, SurfaceCard } from '@my-people/mobile-ui';

/**
 * The top of Home and the Community hub: a plain greeting (Home only), then a compact card with the
 * member's membership state and their district and GN division.
 */
export function MemberWelcomeCard({
  place,
  membershipState,
  greeting = true,
}: {
  place: string;
  membershipState: HomeView['membershipState'];
  /** The "Welcome" heading above the card; the hub shows the card alone. */
  greeting?: boolean;
}) {
  const { t } = useTranslation();
  const membershipTone = membershipState === 'active' ? 'verified' : membershipState === 'pending' ? 'pending' : 'error';

  return (
    <View style={styles.block}>
      {greeting ? (
        <View style={styles.greeting}>
          <AppText step="page" accessibilityRole="header">
            {t('m.home.welcomeTitle')}
          </AppText>
          <AppText step="body" tone="secondary">
            {t('m.home.welcomeSubtitle')}
          </AppText>
        </View>
      ) : null}

      <SurfaceCard style={styles.card}>
        <View style={styles.membership}>
          <IconTile icon="card-outline" size={40} />
          <AppText step="card" style={styles.flex}>
            {t('m.profile.membership')}
          </AppText>
          <StatusTag tone={membershipTone} label={t(`m.home.membership_${membershipState}`)} />
        </View>
        {place ? (
          <View style={styles.place}>
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.textSecondary}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <AppText step="secondary" tone="secondary" style={styles.flex}>
              {place}
            </AppText>
          </View>
        ) : null}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[4] },
  greeting: { gap: spacing[1] },
  card: { gap: spacing[3] },
  membership: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.divider },
  flex: { flex: 1 },
});
