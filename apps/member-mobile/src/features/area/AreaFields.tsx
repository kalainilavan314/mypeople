import type { Place } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

import { SelectField, type SelectOption, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

export type AreaChoice = { district: string | null; ds: string | null; gn: string | null };

export const NO_AREA: AreaChoice = { district: null, ds: null, gn: null };

function placeOptions(places: Place[] | undefined, language: string): SelectOption[] {
  return (places ?? []).map((place) => ({
    value: place.code,
    label: (language === 'ta' ? place.nameTa : place.nameEn) ?? place.nameEn ?? place.code,
  }));
}

type Props = { value: AreaChoice; onChange: (value: AreaChoice) => void; error?: string | null };

/** District, then DS division, then GN division, each from the official lists (BR-017). */
export function AreaFields({ value, onChange, error }: Props) {
  const { t } = useTranslation();
  const language = useLanguage();
  const districts = useApiQuery(() => api().listDistricts());
  const dsDivisions = useApiQuery(
    async () => (value.district ? api().listDsDivisions(value.district) : []),
    [value.district],
  );
  const gnDivisions = useApiQuery(async () => (value.ds ? api().listGnDivisions(value.ds) : []), [value.ds]);

  return (
    <View style={styles.group}>
      <SelectField
        label={t('m.register.district')}
        placeholder={t('m.register.choose')}
        value={value.district}
        options={placeOptions(districts.data, language)}
        onChange={(district) => onChange({ district, ds: null, gn: null })}
        error={districts.error ? t('m.common.loadFailed') : null}
      />
      <SelectField
        label={t('m.register.ds')}
        placeholder={t('m.register.choose')}
        value={value.ds}
        options={placeOptions(dsDivisions.data, language)}
        disabled={!value.district}
        onChange={(ds) => onChange({ ...value, ds, gn: null })}
      />
      <SelectField
        label={t('m.register.gn')}
        placeholder={t('m.register.choose')}
        value={value.gn}
        options={placeOptions(gnDivisions.data, language)}
        disabled={!value.ds}
        onChange={(gn) => onChange({ ...value, gn })}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: spacing[3] } });
