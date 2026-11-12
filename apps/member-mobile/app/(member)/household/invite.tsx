import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type AdultRel = 'spouse' | 'parent' | 'sibling' | 'other';

/**
 * Screen M08: Invite adult member
 * BRD v1.1 SC-22, FR-HH-004, BR-099.
 * Adult invitation with mutual consent requirements.
 */
export default function InviteAdultScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [memberCode, setMemberCode] = useState('');
  const [relationship, setRelationship] = useState<AdultRel>('spouse');
  const [success, setSuccess] = useState(false);

  const invite = useApiAction(async () => {
    setSuccess(false);
    await api().inviteAdult({
      memberCode: memberCode.trim().toUpperCase(),
      relationship,
    });
    setSuccess(true);
    setTimeout(() => {
      router.replace('/household');
    }, 1500);
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
            onChangeText={(v) => setMemberCode(v.toUpperCase())}
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

          {invite.error ? (
            <View style={styles.topMargin}>
              <Notice tone="error">
                {errorMessage(t, invite.error)}
              </Notice>
            </View>
          ) : null}

          {success ? (
            <View style={styles.topMargin}>
              <Notice tone="success">
                {t('m.household.inviteSuccess')}
              </Notice>
            </View>
          ) : null}

          <View style={styles.topMargin}>
            <Button
              label={t('m.household.sendInvite')}
              busy={invite.busy}
              disabled={memberCode.trim().length < 3 || success}
              onPress={() => void invite.run()}
            />
          </View>
        </View>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[2],
  },
  desc: {
    color: colors.textSecondary,
  },
  form: {
    gap: spacing[4],
    marginTop: spacing[2],
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: -spacing[1],
  },
  topMargin: {
    marginTop: spacing[2],
  },
});
