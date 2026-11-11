import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from '@my-people/mobile-ui';

type Props = {
  name: string;
  memberCode: string | null;
  place: string;
  active: boolean;
};

/**
 * The navy member card on Home: name, member ID and area, with the membership state as a labelled
 * pill. It carries no code; the scannable card is on the Card tab (C01, C02), which this opens.
 */
export function MemberCardPreview({ name, memberCode, place, active }: Props) {
  const { t } = useTranslation();
  const state = active ? t('m.home.membership_active') : t('m.home.membership_pending');
  return (
    <Pressable
      onPress={() => router.push('/card')}
      accessibilityRole="link"
      accessibilityLabel={`${t('m.home.memberCard')}, ${name}, ${memberCode ?? ''}, ${state}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image
        source={require('../../../assets/images/icon.png')}
        style={styles.watermark}
        accessible={false}
        importantForAccessibility="no"
      />
      <View style={styles.top}>
        <AppText step="body" style={styles.faint}>
          {t('m.home.memberCard')}
        </AppText>
        <View style={[styles.pill, active ? styles.pillActive : styles.pillPending]}>
          <Ionicons name={active ? 'checkmark-circle' : 'time-outline'} size={15} color={active ? colors.successText : colors.warningText} />
          <AppText step="secondary" tone={active ? 'success' : 'warning'}>
            {state}
          </AppText>
        </View>
      </View>
      <View style={styles.middle}>
        <AppText step="display" tone="inverse" numberOfLines={1}>
          {name}
        </AppText>
        {memberCode ? (
          <AppText step="section" style={[styles.code, styles.faintStrong]}>
            {memberCode}
          </AppText>
        ) : null}
      </View>
      <AppText step="secondary" style={styles.faint} numberOfLines={1}>
        {['என் மக்கள் · My People', place].filter(Boolean).join(' · ')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radius.sheet,
    backgroundColor: colors.primary,
  },
  pressed: { backgroundColor: colors.primaryDark },
  // The logo, faint, in the lower right, as on the printed card.
  watermark: { position: 'absolute', right: -18, bottom: -22, width: 150, height: 150, opacity: 0.12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  middle: { gap: spacing[1] },
  code: { letterSpacing: 2 },
  faint: { color: 'rgba(255,255,255,0.72)' },
  faintStrong: { color: 'rgba(255,255,255,0.86)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.pill },
  pillPending: { backgroundColor: colors.warningPill },
  pillActive: { backgroundColor: colors.successBackground },
});
