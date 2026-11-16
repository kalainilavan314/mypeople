import type { VolunteerAvailability, VolunteerSkills, VolunteerTravelArea } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  confirmAction,
  formatDate,
  Notice,
  Screen,
  SegmentedControl,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { FieldError } from '@/components/FieldError';
import { ToggleChips } from '@/components/ToggleChips';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

// The limits the API enforces (VolunteerProfileIn).
const MAX_SKILLS = 10;

/**
 * H10 My skills: skills from the server's list, when the member is free and how far they travel.
 * Nothing is saved until the member ticks consent to share it with authorised volunteer
 * coordinators (FR-VOL-003); withdrawing consent deletes the profile.
 */
export default function SkillsScreen() {
  const skills = useApiQuery(() => api().getVolunteerSkills());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="volunteer" query={skills}>
        {(data) => <SkillsForm data={data} reload={skills.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function SkillsForm({ data, reload }: { data: VolunteerSkills; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const [skills, setSkills] = useState<string[]>(data.profile?.skills ?? []);
  const [availability, setAvailability] = useState<VolunteerAvailability[]>(data.profile?.availability ?? []);
  const [travelArea, setTravelArea] = useState<VolunteerTravelArea>(data.profile?.travelArea ?? 'my_gn');
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'withdrawn' | null>(null);

  const save = useApiAction(async () => {
    await api().saveVolunteerProfile({ skills, availability, travelArea, consent });
    setOutcome('saved');
    reload();
  });
  const withdraw = useApiAction(async () => {
    const confirmed = await confirmAction({
      title: t('m.volunteer.withdrawConsentTitle'),
      message: t('m.volunteer.withdrawConsentBody'),
      confirmLabel: t('m.volunteer.withdrawConsent'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await api().withdrawVolunteerProfile();
    setSkills([]);
    setAvailability([]);
    setTravelArea('my_gn');
    setConsent(false);
    setShowErrors(false);
    setOutcome('withdrawn');
    reload();
  });

  const skillsMissing = skills.length === 0;
  const tooManySkills = skills.length > MAX_SKILLS;
  const availabilityMissing = availability.length === 0;
  const submit = () => {
    setOutcome(null);
    if (skillsMissing || tooManySkills || availabilityMissing) {
      setShowErrors(true);
      return;
    }
    void save.run();
  };

  return (
    <View style={styles.form}>
      <AppText step="body" tone="secondary">
        {t('m.volunteer.skillsIntro')}
      </AppText>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.volunteer.skillsHeading')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {t('m.volunteer.skillsHint', { max: MAX_SKILLS })}
        </AppText>
        <ToggleChips
          label={t('m.volunteer.skillsHeading')}
          selected={skills}
          onChange={setSkills}
          options={data.skills.map((skill) => ({ key: skill.key, label: localized(skill.nameEn, skill.nameTa) }))}
        />
        {showErrors && skillsMissing ? <FieldError text={t('m.volunteer.skillsError')} /> : null}
        {showErrors && tooManySkills ? <FieldError text={t('m.volunteer.tooManySkills', { max: MAX_SKILLS })} /> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.volunteer.availability')}
        </AppText>
        <ToggleChips
          label={t('m.volunteer.availability')}
          selected={availability}
          onChange={setAvailability}
          options={data.availability.map((key) => ({ key, label: t(`m.volunteer.availability_${key}`) }))}
        />
        {showErrors && availabilityMissing ? <FieldError text={t('m.volunteer.availabilityError')} /> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.volunteer.travelArea')}
        </AppText>
        <SegmentedControl
          label={t('m.volunteer.travelArea')}
          selected={travelArea}
          onSelect={setTravelArea}
          options={[
            { key: 'my_gn', label: t('m.volunteer.travel_my_gn') },
            { key: 'my_ds', label: t('m.volunteer.travel_my_ds') },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Checkbox label={t('m.volunteer.consent')} checked={consent} onChange={setConsent} />
        <AppText step="secondary" tone="muted">
          {t('m.volunteer.consentNote')}
        </AppText>
        {data.profile ? (
          <AppText step="caption" tone="muted">
            {t('m.volunteer.consentedOn', { date: formatDate(data.profile.consentedAt, language) })}
          </AppText>
        ) : null}
      </SurfaceCard>

      {outcome === 'saved' ? <Notice tone="success">{t('m.volunteer.skillsSaved')}</Notice> : null}
      {outcome === 'withdrawn' ? <Notice tone="success">{t('m.volunteer.consentWithdrawn')}</Notice> : null}
      {save.error ?? withdraw.error ? (
        <Notice tone="error">{errorMessage(t, save.error ?? withdraw.error, 'volunteer')}</Notice>
      ) : null}

      <Button
        label={t('m.volunteer.saveSkills')}
        icon="checkmark"
        disabled={!consent || withdraw.busy}
        busy={save.busy}
        accessibilityHint={consent ? undefined : t('m.volunteer.saveNeedsConsent')}
        onPress={submit}
      />
      {!consent ? (
        <AppText step="secondary" tone="muted">
          {t('m.volunteer.saveNeedsConsent')}
        </AppText>
      ) : null}
      {data.profile ? (
        <Button
          label={t('m.volunteer.withdrawConsent')}
          variant="danger"
          icon="trash-outline"
          busy={withdraw.busy}
          disabled={save.busy}
          onPress={() => void withdraw.run()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  card: { gap: spacing[3] },
});
