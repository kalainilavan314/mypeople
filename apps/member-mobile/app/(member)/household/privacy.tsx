import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLocalized,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Screen M10: Household Privacy & Consent / குடும்பத் தனியுரிமை & ஒப்புதல்
 * BRD v1.1 SC-22, FR-HH-010, BR-098, BR-099, BR-100, BR-101.
 * Voluntary participation, bilateral consent, single active household,
 * purpose separation, and withdrawal of consent.
 */
export default function HouseholdPrivacyScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const router = useRouter();

  const noticeQuery = useApiQuery(() => api().getHouseholdPrivacyNotice());
  const householdQuery = useApiQuery(() => api().getMyHousehold());

  const withdrawConsent = useApiAction(async () => {
    await api().leaveHousehold();
    void householdQuery.reload();
  });

  const handleWithdrawConfirm = async (isHead: boolean) => {
    const action = isHead ? t('m.household.dissolveHousehold') : t('m.household.leaveHousehold');
    const confirmed = await confirmAction({
      title: action,
      message: isHead ? t('m.household.dissolveConfirm') : t('m.household.leaveConfirm'),
      confirmLabel: action,
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await withdrawConsent.run();
    router.replace('/household');
  };

  return (
    <Screen
      edges={['bottom']}
      onRefresh={() => {
        void noticeQuery.reload();
        void householdQuery.reload();
      }}
      refreshing={noticeQuery.loading || householdQuery.loading}
    >
      <AppText step="section" accessibilityRole="header">
        {t('m.household.privacyConsent')}
      </AppText>

      <QueryView query={noticeQuery}>
        {(notice) => (
          <SurfaceCard style={styles.card}>
            <AppText step="card" style={styles.cardTitle}>
              {localized(notice.titleEn, notice.titleTa)}
            </AppText>
            <AppText step="body" style={styles.paragraph}>
              {localized(notice.noticeEn, notice.noticeTa)}
            </AppText>
            <View style={styles.ruleBlock}>
              <AppText step="label" style={styles.ruleLabel}>
                {localized('Voluntary Principle', 'தன்னார்வக் கொள்கை')}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {localized(notice.voluntaryClauseEn, notice.voluntaryClauseTa)}
              </AppText>
            </View>
            <View style={styles.ruleBlock}>
              <AppText step="label" style={styles.ruleLabel}>
                {localized('Purpose Separation', 'நோக்கப் பிரிப்பு')}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {localized(notice.purposeLimitationEn, notice.purposeLimitationTa)}
              </AppText>
            </View>
          </SurfaceCard>
        )}
      </QueryView>

      <SurfaceCard style={styles.card}>
        <AppText step="card" style={styles.cardTitle}>
          {t('m.household.privacyPrinciples')}
        </AppText>

        <View style={styles.principleItem}>
          <View style={styles.tagRow}>
            <AppText step="label" style={styles.principleTitle}>
              {localized('Voluntary Participation', 'தன்னார்வப் பங்கேற்பு')}
            </AppText>
          </View>
          <AppText step="secondary" tone="secondary" style={styles.principleText}>
            {localized(
              'Household participation is completely optional and never a requirement for any party assistance, services, or membership rights.',
              'குடும்பத் தொகுதி முற்றிலும் விருப்பத்தின் அடிப்படையிலானது. கட்சி உதவிகள் அல்லது உறுப்பினர் உரிமைகளுக்கு இது கட்டாய நிபந்தனை அல்ல.',
            )}
          </AppText>
        </View>

        <View style={styles.principleItem}>
          <View style={styles.tagRow}>
            <AppText step="label" style={styles.principleTitle}>
              {localized('Mutual Consent', 'இருதரப்பு ஒப்புதல்')}
            </AppText>
          </View>
          <AppText step="secondary" tone="secondary" style={styles.principleText}>
            {localized(
              'Adult members cannot be assigned to a household unilaterally. Both invitation and explicit acceptance are required before linking.',
              'வயதுவந்த உறுப்பினர்களை தன்னிச்சையாக சேர்க்க முடியாது. அழைப்பும் வெளிப்படையான ஒப்புதலும் அவசியமாகும்.',
            )}
          </AppText>
        </View>

        <View style={styles.principleItem}>
          <View style={styles.tagRow}>
            <AppText step="label" style={styles.principleTitle}>
              {localized('Single Household Rule', 'ஒரே குடும்ப விதி')}
            </AppText>
          </View>
          <AppText step="secondary" tone="secondary" style={styles.principleText}>
            {localized(
              'A member can only be an active member of one household at any given time. Prior membership must be severed before joining another.',
              'ஒரு உறுப்பினர் ஒரே நேரத்தில் ஒரு குடும்பக் குழுவில் மட்டுமே உறுப்பினராக இருக்க முடியும்.',
            )}
          </AppText>
        </View>

        <View style={styles.principleItem}>
          <View style={styles.tagRow}>
            <AppText step="label" style={styles.principleTitle}>
              {localized('Purpose separation', 'நோக்கப் பிரிப்பு')}
            </AppText>
          </View>
          <AppText step="secondary" tone="secondary" style={styles.principleText}>
            {t('m.household.dataSeparation')}
          </AppText>
        </View>
      </SurfaceCard>

      <QueryView query={householdQuery}>
        {(household) => (
          <SurfaceCard style={styles.card}>
            <AppText step="card" style={styles.cardTitle}>
              {localized('Your Consent Status', 'உங்கள் ஒப்புதல் நிலை')}
            </AppText>

            {household ? (
              <View>
                <View style={styles.statusRow}>
                  <StatusTag tone="verified" label={localized('Active Consent', 'செயலில் உள்ள ஒப்புதல்')} />
                  <AppText step="body" style={styles.householdName}>
                    {household.name || localized('Unnamed Household', 'பெயரிடப்படாத குடும்பம்')}
                  </AppText>
                </View>
                <AppText step="secondary" tone="secondary" style={styles.paragraph}>
                  {household.isHead
                    ? localized(
                        'You are the registered Head of this household. Dissolving the household withdraws consent for the group and removes all linkages.',
                        'நீங்கள் இக்குடும்பத்தின் தலைவர். குடும்பத்தைக் கலைப்பது அனைவரது இணைப்புகளையும் நீக்கி ஒப்புதலை மீட்டெடுக்கும்.',
                      )
                    : localized(
                        'You are an adult member of this household. You may withdraw your consent and leave the household at any time.',
                        'நீங்கள் இக்குடும்பத்தின் உறுப்பினர். எந்நேரத்திலும் ஒப்புதலைத் திரும்பப் பெற்று வெளியேறலாம்.',
                      )}
                </AppText>

                {withdrawConsent.error ? (
                  <View style={styles.topMargin}>
                    <Notice tone="error">
                      {errorMessage(t, withdrawConsent.error)}
                    </Notice>
                  </View>
                ) : null}

                <View style={styles.topMargin}>
                  <Button
                    label={household.isHead ? t('m.household.dissolveHousehold') : t('m.household.leaveHousehold')}
                    variant="secondary"
                    busy={withdrawConsent.busy}
                    onPress={() => handleWithdrawConfirm(household.isHead)}
                  />
                </View>
              </View>
            ) : (
              <View>
                <StatusTag tone="pending" label={localized('No Active Consent', 'செயலில் உள்ள ஒப்புதல் இல்லை')} />
                <AppText step="secondary" tone="muted" style={styles.topMargin}>
                  {t('m.household.emptyHousehold')}
                </AppText>
              </View>
            )}
          </SurfaceCard>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing[4],
  },
  cardTitle: {
    marginBottom: spacing[1],
  },
  paragraph: {
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing[1],
  },
  ruleBlock: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ruleLabel: {
    marginBottom: spacing[1],
  },
  principleItem: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  principleTitle: {
    flexShrink: 1,
  },
  principleText: {
    lineHeight: 18,
    marginTop: spacing[1],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  householdName: {
    fontWeight: '600',
  },
  topMargin: {
    marginTop: spacing[2],
  },
});
