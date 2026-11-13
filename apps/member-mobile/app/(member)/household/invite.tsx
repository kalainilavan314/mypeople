import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { API_URL, api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type AdultRel = 'spouse' | 'parent' | 'sibling' | 'other';

/**
 * Screen M08: invite an adult (MP-FEA-002 §4.1; BRD FR-HH-004, BR-099).
 * By their member code, or through the share sheet with a short message in Tamil and English that
 * names only the household. The answer never shows the invitee's name: they join, and are named,
 * only after they accept (M09).
 */
export default function InviteAdultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const householdQuery = useApiQuery(() => api().getMyHousehold());

  const [memberCode, setMemberCode] = useState('');
  const [relationship, setRelationship] = useState<AdultRel>('spouse');
  const [success, setSuccess] = useState(false);

  const invite = useApiAction(async () => {
    setSuccess(false);
    await api().inviteAdult({ memberCode: memberCode.trim().toUpperCase(), relationship });
    setSuccess(true);
    setMemberCode('');
  });

  return (
    <Screen edges={['bottom']} maxContentWidth={640}>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.household.inviteAdult')}
        </AppText>
        <AppText step="body" style={styles.desc}>
          {t('m.household.inviteAdultDescription')}
        </AppText>

        <View style={styles.form}>
          <TextField
            label={t('m.household.memberCode')}
            value={memberCode}
            onChangeText={(v) => {
              setSuccess(false);
              setMemberCode(v.toUpperCase());
            }}
            placeholder={t('m.household.memberCodePlaceholder')}
            autoCapitalize="characters"
          />

          <AppText step="caption" style={styles.fieldLabel}>
            {t('m.household.relationship')}
          </AppText>
          <ChipRow<AdultRel>
            label={t('m.household.relationship')}
            selected={relationship}
            onSelect={setRelationship}
            options={[
              { key: 'spouse', label: t('m.household.relationships.spouse') },
              { key: 'parent', label: t('m.household.relationships.parent') },
              { key: 'sibling', label: t('m.household.relationships.sibling') },
              { key: 'other', label: t('m.household.relationships.other') },
            ]}
          />

          {invite.error ? <Notice tone="error">{errorMessage(t, invite.error)}</Notice> : null}
          {success ? <Notice tone="success">{t('m.household.inviteSuccess')}</Notice> : null}

          <Button
            label={t('m.household.sendInvite')}
            busy={invite.busy}
            disabled={memberCode.trim().length < 3}
            onPress={() => void invite.run()}
          />
          {success ? (
            <Button label={t('m.common.done')} variant="quiet" onPress={() => router.replace('/household' as any)} />
          ) : null}
        </View>
      </SurfaceCard>

      <ShareInvitationCard householdName={householdQuery.data?.name ?? null} />
    </Screen>
  );
}

/** M08 share sheet: a message in both languages asking them to join My People and accept the invitation. */
function ShareInvitationCard({ householdName }: { householdName: string | null }) {
  const { t, i18n } = useTranslation();

  const share = async () => {
    const message = (['ta', 'en'] as const)
      .map((language) => {
        const fixed = i18n.getFixedT(language);
        return householdName
          ? fixed('m.household.shareMessage', { household: householdName })
          : fixed('m.household.shareMessageUnnamed');
      })
      .concat(API_URL ? [API_URL] : [])
      .join('\n\n');
    try {
      await Share.share({ message });
    } catch {
      // Closed or not available on this device: nothing was shared.
    }
  };

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.household.shareTitle')}
      </AppText>
      <AppText step="body" style={styles.desc}>
        {t('m.household.shareIntro')}
      </AppText>
      <Button
        label={t('m.household.shareTitle')}
        variant="secondary"
        icon="share-outline"
        onPress={() => void share()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  desc: { color: colors.textSecondary },
  form: { gap: spacing[4], marginTop: spacing[2] },
  fieldLabel: { color: colors.textSecondary, fontWeight: '600', marginBottom: -spacing[1] },
});
