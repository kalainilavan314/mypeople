import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, LanguageToggle, Screen, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CheckForm } from '@/features/official/CheckForm';
import { CheckResult } from '@/features/official/CheckResult';
import { api } from '@/lib/api';
import { chooseLanguage } from '@/lib/i18n';

/**
 * The public check page a check link opens (FR-AUT-005, INT-22): anyone, signed in or not, sees
 * whether a statement matches TMK's signed records. The API asks for no session and stores nothing
 * about the visitor; it limits how often one address may check.
 */
export default function PublicCheckScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { code = '' } = useLocalSearchParams<{ code?: string }>();
  const result = useApiQuery(() => api().checkOfficialStatement(code), [code]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <View style={styles.language}>
        <LanguageToggle value={language} onChange={(choice) => void chooseLanguage(choice)} label={t('m.welcome.chooseLanguage')} />
      </View>
      <AppText step="body" tone="secondary">
        {t('m.official.publicCheckIntro')}
      </AppText>
      <FeatureQueryView feature="official.updates" query={result}>
        {(data) => <CheckResult result={data} />}
      </FeatureQueryView>
      <CheckForm onCheck={(next) => router.replace({ pathname: '/check/[code]', params: { code: next } })} />
      <Button label={t('m.official.openApp')} variant="secondary" icon="home-outline" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({ language: { alignItems: 'flex-end' } });
