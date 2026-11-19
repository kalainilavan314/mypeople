import type { BloodNotice } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDateTime, StatusTag, SurfaceCard, useLanguage } from '@my-people/mobile-ui';

import { ANSWER_TONES, NOTICE_STATE_TONES, URGENCY_TONES } from './labels';

/** A request the donor was told about (M38): who asks, how urgent, by when, and the donor's answer. */
export function NoticeCard({ notice }: { notice: BloodNotice }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const urgency = t(`m.bloodDonors.urgency_${notice.urgency}`);
  const answer = t(`m.bloodDonors.answer_${notice.answer}`);
  const neededBy = t('m.bloodDonors.neededBy', { time: formatDateTime(notice.neededBy, language) });
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/blood-donors/requests/[id]', params: { id: notice.requestId } })}
      accessibilityLabel={`${notice.partnerName}. ${notice.bloodGroup}. ${urgency}. ${neededBy}. ${answer}`}
      accessibilityHint={t('m.bloodDonors.opensRequest')}>
      <View style={styles.tags}>
        <StatusTag tone={URGENCY_TONES[notice.urgency]} label={urgency} />
        {notice.state === 'open' ? (
          <StatusTag tone={ANSWER_TONES[notice.answer]} label={answer} />
        ) : (
          <StatusTag tone={NOTICE_STATE_TONES[notice.state]} label={t(`m.bloodDonors.noticeState_${notice.state}`)} />
        )}
      </View>
      <AppText step="card">{notice.partnerName}</AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.bloodDonors.groupNeeded', { group: notice.bloodGroup })}
      </AppText>
      <AppText step="caption" tone="muted">
        {neededBy}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] } });
