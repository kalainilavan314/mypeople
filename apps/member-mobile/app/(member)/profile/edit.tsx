import type { ProfileView } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChipRow } from '@/components/ChipRow';
import { Notice } from '@/components/Notice';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TextField } from '@/components/TextField';
import { useApiAction, useApiQuery } from '@/hooks/useApi';
import { useLanguage } from '@/hooks/useLanguage';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useSession } from '@/providers/SessionProvider';

type Gender = NonNullable<ProfileView['gender']> | 'skip';

/** P02: the display name and gender. Legal name and date of birth are locked to the verified ID (BR-073). */
export default function EditProfileScreen() {
  const profile = useApiQuery(() => api().getProfile());
  return (
    <Screen edges={['bottom']}>
      <QueryView query={profile}>{(data) => <EditForm profile={data} />}</QueryView>
    </Screen>
  );
}

function EditForm({ profile }: { profile: ProfileView }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { refresh } = useSession();
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [gender, setGender] = useState<Gender>(profile.gender ?? 'skip');
  const [saved, setSaved] = useState(false);
  const save = useApiAction(async () => {
    setSaved(false);
    await api().updateProfile({ displayName: displayName.trim() || null, gender: gender === 'skip' ? null : gender });
    await refresh();
    setSaved(true);
  });

  return (
    <>
      <TextField
        label={t('m.profile.displayName')}
        hint={t('m.profile.displayNameHint')}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={60}
        autoCapitalize="words"
      />
      <AppText step="label">{t('m.profile.gender')}</AppText>
      <ChipRow
        label={t('m.profile.gender')}
        selected={gender}
        onSelect={setGender}
        options={[
          { key: 'skip', label: t('m.register.genderSkip') },
          { key: 'female', label: t('m.register.genderFemale') },
          { key: 'male', label: t('m.register.genderMale') },
          { key: 'other', label: t('m.register.genderOther') },
        ]}
      />
      {save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}
      {saved ? <Notice tone="success">{t('m.profile.saved')}</Notice> : null}
      <Button label={t('m.common.save')} busy={save.busy} busyLabel={t('m.common.saving')} onPress={() => void save.run()} />

      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.profile.lockedTitle')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {t('m.profile.lockedHint')}
        </AppText>
        <View style={styles.locked}>
          <AppText step="label">{t('m.profile.legalName')}</AppText>
          <AppText step="body" tone="secondary">
            {profile.legalName}
          </AppText>
        </View>
        {profile.dateOfBirth ? (
          <View style={styles.locked}>
            <AppText step="label">{t('m.register.dobLabel')}</AppText>
            <AppText step="body" tone="secondary">
              {formatDate(profile.dateOfBirth, language)}
            </AppText>
          </View>
        ) : null}
        {profile.mobileMasked ? (
          <View style={styles.locked}>
            <AppText step="label">{t('m.profile.phoneLabel')}</AppText>
            <AppText step="body" tone="secondary" mono>
              {profile.mobileMasked}
            </AppText>
          </View>
        ) : null}
      </SurfaceCard>
    </>
  );
}

const styles = StyleSheet.create({ locked: { gap: 2, paddingVertical: spacing[1] } });
