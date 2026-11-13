import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, SurfaceCard } from '@my-people/mobile-ui';

/**
 * The receipt after sending (FR-RPT-014): shown only once the server holds the case, with its
 * case ID and what happens next.
 */
export function ReceiptBanner({ caseNumber, nextStep }: { caseNumber: string; nextStep: string | null }) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.banner}>
      <View style={styles.titleRow}>
        <Ionicons name="checkmark-circle" size={28} color={colors.successText} />
        <AppText step="section" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.flex}>
          {t('m.issues.receiptTitle')}
        </AppText>
      </View>
      <View>
        <AppText step="secondary" tone="muted">
          {t('m.issues.caseId')}
        </AppText>
        <AppText step="page" mono>
          {caseNumber}
        </AppText>
      </View>
      <AppText step="secondary" tone="secondary">
        {t('m.issues.receiptBody')}
      </AppText>
      {nextStep ? (
        <View>
          <AppText step="caption" tone="primary">
            {t('m.issues.nextStep')}
          </AppText>
          <AppText step="body">{t(`m.issues.next_${nextStep}`)}</AppText>
        </View>
      ) : null}
      <Button label={t('m.issues.viewMyReports')} icon="list-outline" onPress={() => router.replace('/issues/mine')} />
      <Button label={t('m.issues.backHome')} variant="secondary" icon="home-outline" onPress={() => router.dismissTo('/')} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  banner: { gap: spacing[3], borderColor: colors.successText, backgroundColor: colors.successBackground },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
