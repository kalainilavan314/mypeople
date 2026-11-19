import type { Certificate, CertificateKind, MyCertificates } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CertificateStatusTag } from '@/features/renewal/CertificateStatusTag';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M34 My certificates (FR-RNW-004 to 006): the membership certificate while the membership is
 * Active, an event-participation certificate for each event whose attendance was recorded at
 * check-in, and a volunteer-service certificate listing completed assignments. Each opens as a
 * document with a verification QR, downloadable as a PDF; none shows an NIC or passport number.
 */
export default function CertificatesScreen() {
  const { t } = useTranslation();
  const mine = useApiQuery(() => api().getMyCertificates());
  useReloadOnFocus(mine.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={mine.reload} refreshing={mine.loading && mine.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.renewal.certificatesIntro')}
      </AppText>
      <FeatureQueryView feature="renewal" query={mine}>
        {(data) => <CertificatesBody data={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function open(certificate: Certificate) {
  router.push({ pathname: '/renewal/certificate/[id]', params: { id: certificate.id } } as Href);
}

function CertificatesBody({ data }: { data: MyCertificates }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const request = useApiAction(async (kind: CertificateKind, eventId?: string) => {
    open(await api().requestCertificate(kind, eventId));
  });

  return (
    <>
      <AppText step="section" accessibilityRole="header">
        {t('m.renewal.getTitle')}
      </AppText>
      {request.error ? <Notice tone="error">{errorMessage(t, request.error, 'renewal')}</Notice> : null}

      <SurfaceCard>
        <AppText step="card">{t('m.renewal.membershipTitle')}</AppText>
        {data.membershipProblems.length === 0 ? (
          <Button
            label={t('m.renewal.getMembership')}
            icon="ribbon-outline"
            busy={request.busy}
            busyLabel={t('m.common.sending')}
            onPress={() => void request.run('membership')}
          />
        ) : (
          <AppText step="secondary" tone="muted">
            {t('m.renewal.membershipUnavailable')}
          </AppText>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <AppText step="card">{t('m.renewal.eventsTitle')}</AppText>
        {data.events.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('m.renewal.noEvents')}
          </AppText>
        ) : (
          data.events.map((event, index) => (
            <View key={event.eventId} style={[styles.event, index > 0 && styles.divided]}>
              <View style={styles.flex}>
                <AppText step="label">{localized(event.titleEn, event.titleTa)}</AppText>
                <AppText step="secondary" tone="muted">
                  {formatDate(event.date, language)}
                </AppText>
              </View>
              {event.hasCertificate ? (
                <AppText step="secondary" tone="success">
                  {t('m.renewal.eventHasCertificate')}
                </AppText>
              ) : (
                <Button
                  label={t('m.renewal.getEvent')}
                  variant="secondary"
                  disabled={request.busy}
                  onPress={() => void request.run('event_participation', event.eventId)}
                />
              )}
            </View>
          ))
        )}
      </SurfaceCard>

      <SurfaceCard>
        <AppText step="card">{t('m.renewal.volunteerTitle')}</AppText>
        {data.completedAssignments > 0 ? (
          <>
            <AppText step="secondary" tone="secondary">
              {t('m.renewal.volunteerCount', { count: data.completedAssignments })}
            </AppText>
            <Button
              label={t('m.renewal.getVolunteer')}
              variant="secondary"
              disabled={request.busy}
              onPress={() => void request.run('volunteer_service')}
            />
          </>
        ) : (
          <AppText step="secondary" tone="muted">
            {t('m.renewal.noVolunteer')}
          </AppText>
        )}
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.renewal.mineTitle')}
      </AppText>
      {data.certificates.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.renewal.none')}
        </AppText>
      ) : (
        <View style={styles.list}>
          {data.certificates.map((certificate) => (
            <SurfaceCard
              key={certificate.id}
              onPress={() => open(certificate)}
              accessibilityLabel={`${t(`m.renewal.kind_${certificate.kind}`)}, ${certificate.certificateRef}, ${t(`m.renewal.status_${certificate.status}`)}`}
              accessibilityHint={t('m.renewal.open')}>
              <AppText step="card">{t(`m.renewal.kind_${certificate.kind}`)}</AppText>
              <AppText step="secondary" tone="muted" mono>
                {certificate.certificateRef}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {t('m.renewal.issuedOn', { date: formatDate(certificate.issuedOn, language) })}
              </AppText>
              <CertificateStatusTag certificate={certificate} />
            </SurfaceCard>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], flexWrap: 'wrap' },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  flex: { flex: 1, minWidth: 160 },
  list: { gap: spacing[3] },
});
