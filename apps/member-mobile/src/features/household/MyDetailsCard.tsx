import type { HouseholdMember } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, ChipRow, Notice, SurfaceCard, useApiAction } from '@my-people/mobile-ui';

import { AGE_BANDS, OCCUPATIONS, type AgeBand, type Occupation } from '@/features/household/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M07 / OD-30: an adult's own age band and occupation category. Only the adult sets them;
 * both are optional and can be cleared.
 */
export function MyDetailsCard({ me, onSaved }: { me: HouseholdMember; onSaved: () => void }) {
  const { t } = useTranslation();
  const [ageBand, setAgeBand] = useState<AgeBand | null>(me.ageBand ?? null);
  const [occupation, setOccupation] = useState<Occupation | null>(me.occupationCategory ?? null);
  const [saved, setSaved] = useState(false);

  const save = useApiAction(async () => {
    setSaved(false);
    await api().updateMyHouseholdDetails({ ageBand, occupationCategory: occupation });
    setSaved(true);
    onSaved();
  });

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.household.myDetails')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.household.myDetailsIntro')}
      </AppText>

      <View style={styles.field}>
        <AppText step="label">{t('m.household.ageBand')}</AppText>
        <ChipRow<AgeBand>
          label={t('m.household.ageBand')}
          selected={ageBand}
          onSelect={(next) => {
            setSaved(false);
            setAgeBand(next);
          }}
          options={AGE_BANDS.map((key) => ({ key, label: t(`m.household.ageBands.${key}`) }))}
        />
        {ageBand ? (
          <Button label={t('m.household.clearDetail')} variant="quiet" onPress={() => setAgeBand(null)} />
        ) : null}
      </View>

      <View style={styles.field}>
        <AppText step="label">{t('m.household.occupation')}</AppText>
        <ChipRow<Occupation>
          label={t('m.household.occupation')}
          selected={occupation}
          onSelect={(next) => {
            setSaved(false);
            setOccupation(next);
          }}
          options={OCCUPATIONS.map((key) => ({ key, label: t(`m.household.occupations.${key}`) }))}
        />
        {occupation ? (
          <Button label={t('m.household.clearDetail')} variant="quiet" onPress={() => setOccupation(null)} />
        ) : null}
      </View>

      {save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}
      {saved ? <Notice tone="success">{t('m.household.detailsSaved')}</Notice> : null}
      <Button label={t('m.household.saveDetails')} busy={save.busy} onPress={() => void save.run()} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  field: { gap: spacing[1], marginTop: spacing[2] },
});
