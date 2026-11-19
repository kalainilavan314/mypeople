import type { Place } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { SelectField, type SelectOption, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

export type BroadArea = { district: string | null; ds: string | null };

function options(places: Place[] | undefined, language: string): SelectOption[] {
  return (places ?? []).map((place) => ({
    value: place.code,
    label: (language === 'ta' ? place.nameTa : place.nameEn) ?? place.nameEn ?? place.code,
  }));
}

/**
 * A broad service area for a blood donor (FR-BLD-001): a district, and a DS division only if the donor
 * wants it narrower. Never a GN division or an address.
 */
export function BroadAreaFields({ value, onChange, error }: { value: BroadArea; onChange: (value: BroadArea) => void; error?: string | null }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const districts = useApiQuery(() => api().listDistricts());
  const divisions = useApiQuery(async () => (value.district ? api().listDsDivisions(value.district) : []), [value.district]);
  return (
    <View style={styles.group}>
      <SelectField
        label={t('m.register.district')}
        placeholder={t('m.register.choose')}
        value={value.district}
        options={options(districts.data, language)}
        onChange={(district) => onChange({ district, ds: null })}
        error={districts.error ? t('m.common.loadFailed') : (error ?? null)}
      />
      <SelectField
        label={t('m.bloodDonors.dsOptional')}
        placeholder={t('m.bloodDonors.wholeDistrict')}
        value={value.ds ?? ''}
        options={[{ value: '', label: t('m.bloodDonors.wholeDistrict') }, ...options(divisions.data, language)]}
        disabled={!value.district}
        onChange={(ds) => onChange({ ...value, ds: ds || null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: spacing[3] } });
