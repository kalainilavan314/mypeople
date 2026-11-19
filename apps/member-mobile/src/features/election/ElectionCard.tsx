import type { ElectionBanner, ElectionNotice } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  formatDateTime,
  Notice,
  StatusTag,
  SurfaceCard,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';

import { openOfficialLink } from './openOfficialLink';

/**
 * One election running for the member's area (FR-ELX-001, 004; NFR-ELC-06): the polling day and the
 * countdown from the Election Commission's publication, cited with its document and time, the silence
 * period when it is in force, and the notices published for it, each labelled with where it came from.
 */
export function ElectionCard({ election }: { election: ElectionBanner }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();

  return (
    <View style={styles.election}>
      <SurfaceCard accent style={styles.card}>
        <StatusTag tone="neutral" label={localized(election.labelEn, election.labelTa)} />
        <AppText step="section" accessibilityRole="header">
          {localized(election.titleEn, election.titleTa)}
        </AppText>
        <DetailRow label={t('m.election.pollingDay')} value={formatDate(election.pollingDay, language)} />
        <AppText step="body" tone="primary">
          {election.daysToPolling === 0
            ? t('m.election.pollingToday')
            : t('m.election.countdown', { count: election.daysToPolling })}
        </AppText>
        <DetailRow label={t('m.election.source')} value={election.sourceReference} />
        <AppText step="caption" tone="muted">
          {t('m.election.sourcePublished', { date: formatDateTime(election.sourcePublishedAt, language) })}
        </AppText>
        <Button
          label={t('m.election.openSource')}
          variant="secondary"
          icon="document-text-outline"
          onPress={() => openOfficialLink(t, election.sourceUrl)}
        />
      </SurfaceCard>
      {election.inSilence ? (
        <Notice tone="warning" title={t('m.election.silenceTitle')}>
          {t('m.election.silenceBody', { time: formatDateTime(election.silenceEndsAt, language) })}
        </Notice>
      ) : null}
      {election.notices.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.election.notices')}
          </AppText>
          {election.notices.map((notice, index) => (
            <NoticeItem key={notice.id} notice={notice} first={index === 0} />
          ))}
        </SurfaceCard>
      ) : null}
    </View>
  );
}

function NoticeItem({ notice, first }: { notice: ElectionNotice; first: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  return (
    <View style={[styles.notice, !first && styles.divider]}>
      <StatusTag tone="neutral" label={localized(notice.labelEn, notice.labelTa)} />
      <AppText step="card">{localized(notice.titleEn, notice.titleTa)}</AppText>
      <AppText step="secondary" tone="secondary">
        {localized(notice.bodyEn, notice.bodyTa)}
      </AppText>
      {notice.documentReference ? <DetailRow label={t('m.election.documentReference')} value={notice.documentReference} /> : null}
      <AppText step="caption" tone="muted">
        {t('m.election.sourcePublished', {
          date: formatDateTime(notice.sourcePublishedAt ?? notice.publishedAt, language),
        })}
      </AppText>
      {notice.sourceUrl ? (
        <Button
          label={t('m.election.openSource')}
          variant="quiet"
          icon="document-text-outline"
          onPress={() => openOfficialLink(t, notice.sourceUrl ?? '')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  election: { gap: spacing[3] },
  card: { gap: spacing[3] },
  notice: { gap: spacing[2], paddingTop: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
