import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { ANSWER_TONES, NOTICE_STATE_TONES, URGENCY_TONES } from '@/features/bloodDonors/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M38 Donation request response: a private notice that a hospital or the blood transfusion service needs
 * the donor's blood group in their area. Accepting with consent passes the donor's name, phone and contact
 * ways to that partner, and nothing else; declining or not answering shares nothing (FR-BLD-005). The
 * hospital's staff decide whether the donor can give (OS-15).
 */
export default function BloodRequestScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const notice = useApiQuery(() => api().getBloodNotice(id), [id]);
  const area = useAreaName(notice.data?.areaKey ?? null);
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const answer = useApiAction(async (accept: boolean) => {
    await api().answerBloodNotice(id, accept, accept && consent);
    notice.reload();
  });

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={notice.reload} refreshing={notice.loading && notice.data !== undefined}>
      <FeatureQueryView feature="bloodDonors" query={notice}>
        {(data) => (
          <View style={styles.body}>
            <View style={styles.tags}>
              <StatusTag tone={URGENCY_TONES[data.urgency]} label={t(`m.bloodDonors.urgency_${data.urgency}`)} />
              <StatusTag tone={NOTICE_STATE_TONES[data.state]} label={t(`m.bloodDonors.noticeState_${data.state}`)} />
            </View>
            <AppText step="page" accessibilityRole="header">
              {t('m.bloodDonors.requestHeading', { partner: data.partnerName })}
            </AppText>
            <SurfaceCard style={styles.card}>
              <DetailRow label={t('m.bloodDonors.bloodGroup')} value={data.bloodGroup} />
              <DetailRow label={t('m.bloodDonors.area')} value={area ?? data.areaKey} />
              <DetailRow label={t('m.bloodDonors.neededByLabel')} value={formatDateTime(data.neededBy, language)} />
              <DetailRow label={t('m.bloodDonors.partnerKind')} value={t(`m.bloodDonors.kind_${data.partnerKind}`)} />
              <DetailRow label={t('m.bloodDonors.reference')} value={data.requestRef} mono />
            </SurfaceCard>
            <Notice tone="info" title={t('m.bloodDonors.medicalTitle')}>
              {t('m.bloodDonors.medicalStatement')}
            </Notice>

            {data.answer !== 'notified' ? (
              <SurfaceCard style={styles.card}>
                <StatusTag tone={ANSWER_TONES[data.answer]} label={t(`m.bloodDonors.answer_${data.answer}`)} />
                <AppText step="body" tone="secondary">
                  {data.answer === 'accepted'
                    ? t('m.bloodDonors.acceptedBody', { partner: data.partnerName })
                    : t('m.bloodDonors.declinedBody')}
                </AppText>
                {data.answeredAt ? (
                  <AppText step="caption" tone="muted">
                    {t('m.bloodDonors.answeredOn', { time: formatDateTime(data.answeredAt, language) })}
                  </AppText>
                ) : null}
              </SurfaceCard>
            ) : data.state !== 'open' ? (
              <Notice tone="info" title={t('m.bloodDonors.closedTitle')}>
                {t('m.bloodDonors.closedBody')}
              </Notice>
            ) : (
              <SurfaceCard style={styles.card}>
                <AppText step="section" accessibilityRole="header">
                  {t('m.bloodDonors.answerHeading')}
                </AppText>
                <AppText step="secondary" tone="secondary">
                  {t('m.bloodDonors.answerIntro')}
                </AppText>
                <Checkbox
                  label={t('m.bloodDonors.shareConsent', { partner: data.partnerName })}
                  checked={consent}
                  onChange={(on) => {
                    setConsent(on);
                    setConsentMissing(false);
                  }}
                />
                {consentMissing ? (
                  <AppText step="secondary" tone="error">
                    {t('m.bloodDonors.shareConsentError')}
                  </AppText>
                ) : null}
                {answer.error ? <Notice tone="error">{errorMessage(t, answer.error, 'bloodDonors')}</Notice> : null}
                <Button
                  label={t('m.bloodDonors.accept')}
                  icon="checkmark-circle-outline"
                  busy={answer.busy}
                  onPress={() => {
                    if (!consent) {
                      setConsentMissing(true);
                      return;
                    }
                    void answer.run(true);
                  }}
                />
                <Button
                  label={t('m.bloodDonors.decline')}
                  variant="secondary"
                  disabled={answer.busy}
                  onPress={() => void answer.run(false)}
                />
                <AppText step="caption" tone="muted">
                  {t('m.bloodDonors.noAnswerShares')}
                </AppText>
              </SurfaceCard>
            )}
          </View>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[3] },
});
