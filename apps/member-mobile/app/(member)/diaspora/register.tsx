import type { DiasporaMe, DiasporaOptions, DiasporaTopic } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  Notice,
  Screen,
  SelectField,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLocalized,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { zoneCity } from '@/features/diaspora/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Loaded = { options: DiasporaOptions; me: DiasporaMe };

/**
 * M46 registration (FR-DSP-001): country of residence, time zone, what to be told about and the
 * skills the supporter could offer remotely, kept with their consent until they withdraw. It does
 * not verify identity, make anyone a member, or open any way to contribute (BR-147).
 */
export default function DiasporaRegisterScreen() {
  const loaded = useApiQuery<Loaded>(async () => {
    const [options, me] = await Promise.all([api().getDiasporaOptions(), api().getMyDiaspora()]);
    return { options, me };
  }, []);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="diaspora" query={loaded}>
        {(data) => <RegisterForm options={data.options} me={data.me} />}
      </FeatureQueryView>
    </Screen>
  );
}

function RegisterForm({ options, me }: { options: DiasporaOptions; me: DiasporaMe }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const current = me.supporter;
  const [country, setCountry] = useState<string | null>(current?.countryCode ?? null);
  const [zone, setZone] = useState<string | null>(current?.timeZone ?? null);
  const [topics, setTopics] = useState<DiasporaTopic[]>(current?.contactTopics ?? []);
  const [skills, setSkills] = useState<string[]>(current?.skills ?? []);
  const [consent, setConsent] = useState(current !== null && current !== undefined);
  const [showErrors, setShowErrors] = useState(false);
  const zones = options.countries.find((entry) => entry.code === country)?.timeZones ?? [];
  const save = useApiAction(async () => {
    if (!country || !zone) return;
    await api().saveMyDiaspora({ countryCode: country, timeZone: zone, contactTopics: topics, skills, consent });
    router.back();
  });

  const toggle = <T extends string>(list: T[], value: T, on: boolean): T[] =>
    on ? [...new Set([...list, value])] : list.filter((item) => item !== value);
  const countryName = (code: string) => t(`m.diaspora.country_${code}`, { defaultValue: code });

  return (
    <>
      <AppText step="body" tone="secondary">
        {t('m.diaspora.registerIntro')}
      </AppText>
      <Notice tone="warning" title={t('m.diaspora.contributionsOffTitle')}>
        {t('m.diaspora.contributionsOffBody')}
      </Notice>

      <SurfaceCard style={styles.card}>
        <SelectField
          label={t('m.diaspora.country')}
          placeholder={t('m.diaspora.chooseCountry')}
          value={country}
          onChange={(code) => {
            setCountry(code);
            const first = options.countries.find((entry) => entry.code === code)?.timeZones ?? [];
            setZone(first.length === 1 ? first[0] : null);
          }}
          error={showErrors && !country ? t('m.diaspora.chooseCountry') : null}
          options={options.countries
            .map((entry) => ({ value: entry.code, label: countryName(entry.code) }))
            .sort((a, b) => a.label.localeCompare(b.label))}
        />
        <AppText step="secondary" tone="muted">
          {t('m.diaspora.countryMissing')}
        </AppText>
        <SelectField
          label={t('m.diaspora.timeZone')}
          placeholder={t('m.diaspora.chooseZone')}
          value={zone}
          onChange={setZone}
          disabled={!country}
          error={showErrors && !zone ? t('m.diaspora.chooseZone') : null}
          options={zones.map((name) => ({ value: name, label: zoneCity(name) }))}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.diaspora.contactTitle')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {t('m.diaspora.contactHint')}
        </AppText>
        {options.topics.map((topic) => (
          <Checkbox
            key={topic}
            label={t(`m.diaspora.topic_${topic}`)}
            checked={topics.includes(topic)}
            onChange={(on) => setTopics(toggle(topics, topic, on))}
          />
        ))}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.diaspora.skillsTitle')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {t('m.diaspora.skillsHint')}
        </AppText>
        {options.skills.map((skill) => (
          <Checkbox
            key={skill.key}
            label={localized(skill.nameEn, skill.nameTa)}
            checked={skills.includes(skill.key)}
            onChange={(on) => setSkills(toggle(skills, skill.key, on))}
          />
        ))}
      </SurfaceCard>

      <View style={styles.card}>
        <Checkbox label={t('m.diaspora.consent')} checked={consent} onChange={setConsent} />
        {showErrors && !consent ? <Notice tone="error">{t('m.diaspora.refusals.consent_required')}</Notice> : null}
        {save.error ? <Notice tone="error">{errorMessage(t, save.error, 'diaspora')}</Notice> : null}
        <Button
          icon="checkmark-circle-outline"
          label={current ? t('m.diaspora.saveChanges') : t('m.diaspora.register')}
          busy={save.busy}
          onPress={() => {
            if (!country || !zone || !consent) {
              setShowErrors(true);
              return;
            }
            void save.run();
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
});
