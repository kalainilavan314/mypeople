import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';

import { ChipRow, TextField } from '@my-people/mobile-ui';

export type IdRoute = 'nic' | 'passport';

export type IdNumber = { route: IdRoute; number: string; country: string };

type Props = { value: IdNumber; onChange: (value: IdNumber) => void; error?: string | null };

/** The NIC, or a passport number and its issuing country: how members sign in and recover. */
export function IdRouteFields({ value, onChange, error }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.group}>
      <ChipRow
        label={t('m.register.routeTitle')}
        options={[
          { key: 'nic', label: t('m.signIn.nic') },
          { key: 'passport', label: t('m.signIn.passport') },
        ]}
        selected={value.route}
        onSelect={(route) => onChange({ ...value, route })}
      />
      {value.route === 'nic' ? (
        <TextField
          label={t('m.signIn.nicLabel')}
          hint={t('m.signIn.nicHint')}
          value={value.number}
          onChangeText={(number) => onChange({ ...value, number })}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          error={error}
        />
      ) : (
        <>
          <TextField
            label={t('m.signIn.passportLabel')}
            value={value.number}
            onChangeText={(number) => onChange({ ...value, number })}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            error={error}
          />
          <TextField
            label={t('m.signIn.countryLabel')}
            hint={t('m.signIn.countryHint')}
            value={value.country}
            onChangeText={(country) => onChange({ ...value, country: country.toUpperCase() })}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
          />
        </>
      )}
    </View>
  );
}

export type AccountFields = { nic: string } | { passportNumber: string; passportCountry: string };

/** The API's account fields for this ID: {nic} or {passportNumber, passportCountry}. */
export function accountNumber(value: IdNumber): AccountFields {
  return value.route === 'nic'
    ? { nic: value.number.trim() }
    : { passportNumber: value.number.trim(), passportCountry: value.country.trim() };
}

const styles = StyleSheet.create({ group: { gap: spacing[3] } });
