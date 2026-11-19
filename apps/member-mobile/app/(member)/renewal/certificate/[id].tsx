import type { Certificate } from '@my-people/api-client';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ElementRef } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CertificateDocument } from '@/features/renewal/CertificateDocument';
import { CertificateStatusTag } from '@/features/renewal/CertificateStatusTag';
import { certificateText } from '@/features/renewal/certificateText';
import { saveCertificatePdf } from '@/features/renewal/saveCertificate';
import { api } from '@/lib/api';

/** The widest the certificate is drawn on screen; the PDF picture is made larger from it. */
const MAX_WIDTH = 420;

/**
 * M34: one certificate as a document with its verification QR (FR-RNW-004, BR-137), downloadable
 * as a PDF and shareable as a check link. The shared copy carries only what the certificate says,
 * never an NIC or passport number. A revoked or replaced certificate is shown, but not offered for
 * download: anyone who checks it sees its status.
 */
export default function CertificateScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mine = useApiQuery(() => api().getMyCertificates(), [id]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={mine.reload} refreshing={mine.loading && mine.data !== undefined}>
      <FeatureQueryView feature="renewal" query={mine}>
        {(data) => {
          const certificate = data.certificates.find((item) => item.id === id);
          return certificate ? <CertificateView certificate={certificate} /> : <Notice tone="warning">{t('m.renewal.notFound')}</Notice>;
        }}
      </FeatureQueryView>
    </Screen>
  );
}

function CertificateView({ certificate }: { certificate: Certificate }) {
  const { t } = useTranslation();
  const page = useRef<ElementRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [outcome, setOutcome] = useState<'saved' | 'failed' | 'copied' | null>(null);
  const [busy, setBusy] = useState(false);
  const text = useMemo(() => certificateText(certificate, t), [certificate, t]);
  const kind = t(`m.renewal.kind_${certificate.kind}`);
  const valid = certificate.status === 'valid';

  const download = async () => {
    if (busy || !size) return;
    setBusy(true);
    setOutcome(null);
    try {
      await saveCertificatePdf(page, size, text, `TMK-${certificate.certificateRef}.pdf`, kind);
      setOutcome('saved');
    } catch {
      setOutcome('failed');
    } finally {
      setBusy(false);
    }
  };

  const shareLink = async () => {
    const url = certificate.verifyUrl ?? '';
    setOutcome(null);
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(url);
      setOutcome('copied');
      return;
    }
    await Share.share({ message: t('m.renewal.shareMessage', { kind, ref: certificate.certificateRef, url }) }).catch(() => undefined);
  };

  return (
    <>
      <SurfaceCard>
        <AppText step="card">{kind}</AppText>
        <AppText step="secondary" tone="muted" mono>
          {certificate.certificateRef}
        </AppText>
        <CertificateStatusTag certificate={certificate} />
      </SurfaceCard>

      <View style={styles.slot} onLayout={(event) => setWidth(Math.min(event.nativeEvent.layout.width, MAX_WIDTH))}>
        {width > 0 ? (
          <View onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
            <CertificateDocument pageRef={page} text={text} width={width} qrLabel={t('m.renewal.doc_check')} />
          </View>
        ) : null}
      </View>

      {valid ? (
        <>
          {outcome === 'saved' ? <Notice tone="success">{t('m.renewal.downloaded')}</Notice> : null}
          {outcome === 'failed' ? <Notice tone="error">{t('m.renewal.downloadFailed')}</Notice> : null}
          {outcome === 'copied' ? <Notice tone="success">{t('m.renewal.linkCopied')}</Notice> : null}
          <Button
            label={t('m.renewal.download')}
            icon="cloud-download-outline"
            busy={busy}
            busyLabel={t('m.renewal.downloading')}
            disabled={!size}
            onPress={() => void download()}
          />
          <Button label={t('m.renewal.shareLink')} icon="share-outline" variant="secondary" onPress={() => void shareLink()} />
        </>
      ) : (
        <Notice tone="warning">{t('m.renewal.notValidNote')}</Notice>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%', alignItems: 'center', gap: spacing[2] },
});
