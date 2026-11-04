import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';
import { AppText, Button, Screen, SurfaceCard } from '@my-people/mobile-ui';

/** M07: Adults join only after responding to their own invitation. */
export default function AddMemberScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen edges={['bottom']}>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.household.inviteAdult')}
        </AppText>
        <AppText step="body" style={styles.description}>
          {t('m.household.inviteAdultDescription')}
        </AppText>
        <View style={styles.action}>
          <Button label={t('m.household.inviteAdult')} onPress={() => router.push('/(member)/household/invite' as any)} />
        </View>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[1] },
  description: { color: colors.textSecondary, marginTop: spacing[1] },
  action: { marginTop: spacing[4] },
});
