import { ApiError, type PublicCertificate } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  LanguageToggle,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { featureClosed } from '@/lib/errors';
import { chooseLanguage } from '@/lib/i18n';

/**
 * INT-22, FR-RNW-007: anyone who scans a certificate's QR sees only its type, its issue date and
 * whether it is Valid, Revoked or Superseded, and the holder's name only while it is valid. Nothing
 * else about the holder is ever shown here.
 */
export default function CertificateCheckScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { token } = useLocalSearchParams<{ token: string }>();
  const check = useApiQuery(() => api().checkCertificate(token ?? ''), [token]);
  const error = check.error;
  const answered = error instanceof ApiError ? error : null;

  return (
    <Screen edges={['bottom']} maxContentWidth={640} onRefresh={check.reload}>
      <View style={styles.language}>
        <LanguageToggle value={language} onChange={(choice) => void chooseLanguage(choice)} label={t('m.welcome.chooseLanguage')} />
      </View>
      <AppText step="body" tone="secondary">
        {t('m.renewal.checkIntro')}
      </AppText>
      {featureClosed(error) ? (
        <Notice tone="info" title={t('m.renewal.notOpenTitle')}>
          {t('m.renewal.notOpenBody')}
        </Notice>
      ) : answered?.status === 404 ? (
        <Notice tone="error">{t('m.renewal.checkNotFound')}</Notice>
      ) : answered?.status === 429 ? (
        <Notice tone="warning">{t('m.renewal.checkTooMany')}</Notice>
      ) : (
        <QueryView query={check}>{(result) => <CheckResult result={result} />}</QueryView>
      )}
      {error && !featureClosed(error) && answered?.status !== 404 ? (
        <Button label={t('m.common.retry')} variant="secondary" onPress={check.reload} />
      ) : null}
    </Screen>
  );
}

function CheckResult({ result }: { result: PublicCertificate }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard>
      <StatusTag
        tone={result.status === 'valid' ? 'verified' : result.status === 'revoked' ? 'error' : 'neutral'}
        label={t(`m.renewal.check_${result.status}`)}
      />
      {result.status === 'revoked' ? <Notice tone="error">{t('m.renewal.checkRevokedBody')}</Notice> : null}
      {result.status === 'superseded' ? <Notice tone="warning">{t('m.renewal.checkSupersededBody')}</Notice> : null}
      <View style={styles.details}>
        <DetailRow label={t('m.renewal.checkType')} value={t(`m.renewal.kind_${result.kind}`)} />
        {result.holderName ? <DetailRow label={t('m.renewal.checkHolder')} value={result.holderName} /> : null}
        <DetailRow label={t('m.renewal.checkIssued')} value={formatDate(result.issuedOn, language)} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  language: { alignItems: 'flex-end' },
  details: { gap: spacing[2] },
});
