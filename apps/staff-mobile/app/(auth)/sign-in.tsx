import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { radius, spacing } from '@my-people/design-tokens';
import { AppText, Button, ChipRow, Notice, Screen, TextField, useApiAction, useSession } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { chooseLanguage } from '@/lib/i18n';

type Route = 'nic' | 'passport';

/**
 * S01: sign in with the staff member's own account (NIC, or passport and
 * country). The authenticator code and the role check follow in (staff).
 */
export default function StaffSignInScreen() {
  const { t, i18n } = useTranslation();
  const { start, state } = useSession();
  const [route, setRoute] = useState<Route>('nic');
  const [number, setNumber] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useApiAction(async () => {
    const result =
      route === 'nic'
        ? await api().signIn(number.trim(), password)
        : await api().signInWithPassport(number.trim(), country.trim(), password);
    await start(result);
  });
  const ready = number.trim() !== '' && password !== '' && (route === 'nic' || country.trim().length === 3);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessible={false} accessibilityIgnoresInvertColors />
        <AppText step="page" accessibilityRole="header">
          {t('s.signIn.title')}
        </AppText>
        <AppText step="secondary" tone="muted" style={styles.center}>
          {t('s.signIn.subtitle')}
        </AppText>
      </View>
      <ChipRow
        label={t('s.profile.language')}
        selected={i18n.language === 'ta' ? 'ta' : 'en'}
        onSelect={(language) => void chooseLanguage(language)}
        options={[
          { key: 'ta', label: 'தமிழ்' },
          { key: 'en', label: 'English' },
        ]}
      />
      {state.status === 'signed_out' && state.expired ? <Notice tone="warning">{t('s.signIn.expired')}</Notice> : null}
      <ChipRow
        label={t('s.signIn.title')}
        selected={route}
        onSelect={setRoute}
        options={[
          { key: 'nic', label: t('s.signIn.nic') },
          { key: 'passport', label: t('s.signIn.passport') },
        ]}
      />
      <TextField
        label={route === 'nic' ? t('s.signIn.nicLabel') : t('s.signIn.passportLabel')}
        value={number}
        onChangeText={setNumber}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {route === 'passport' ? (
        <TextField
          label={t('s.signIn.countryLabel')}
          value={country}
          onChangeText={(value) => setCountry(value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={3}
        />
      ) : null}
      <TextField label={t('s.signIn.passwordLabel')} value={password} onChangeText={setPassword} secret autoComplete="current-password" />
      {signIn.error ? <Notice tone="error">{errorMessage(t, signIn.error)}</Notice> : null}
      <Button label={t('s.signIn.submit')} busy={signIn.busy} disabled={!ready} onPress={() => void signIn.run()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing[2], paddingTop: spacing[6] },
  logo: { width: 72, height: 72, borderRadius: radius.card },
  center: { textAlign: 'center' },
});
