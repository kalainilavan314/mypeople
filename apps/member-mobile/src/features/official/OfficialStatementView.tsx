import type { OfficialStatementFile } from '@my-people/api-client';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, formatDate, formatDateTime, Notice, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';

import { OfficialImage } from './OfficialImage';
import { OfficialStatusTag } from './OfficialStatusTag';
import { RevisionHistory } from './RevisionHistory';

/**
 * One statement as M47 and the check result show it: its label, the latest signed version, who
 * published it and when, its check code to share, and every earlier version (FR-AUT-003, 004).
 */
export function OfficialStatementView({ statement }: { statement: OfficialStatementFile }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const latest = statement.latest;
  const withdrawalReason = statement.withdrawalReasonEn
    ? localized(statement.withdrawalReasonEn, statement.withdrawalReasonTa ?? '')
    : null;

  return (
    <>
      <View style={styles.header}>
        <OfficialStatusTag state={statement.state} signed={statement.signed} />
        <AppText step="page" accessibilityRole="header">
          {localized(latest.titleEn, latest.titleTa)}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.official.publishedBy', { name: localized(latest.publisherNameEn, latest.publisherNameTa) })}
        </AppText>
        <AppText step="caption" tone="muted">
          {t('m.official.publishedOn', { date: formatDateTime(statement.firstPublishedAt, language) })}
        </AppText>
        {statement.revisionCount > 1 ? (
          <AppText step="caption" tone="muted">
            {`${t('m.official.correctedOn', { date: formatDateTime(statement.lastPublishedAt, language) })} · ${t(
              'm.official.corrections',
              { count: statement.revisionCount - 1 },
            )}`}
          </AppText>
        ) : null}
      </View>

      {!statement.signed ? <Notice tone="error">{t('m.official.notVerifiedWarning')}</Notice> : null}
      {statement.state === 'withdrawn' && statement.withdrawnAt ? (
        <Notice tone="warning" title={t('m.official.withdrawnTitle')}>
          {[
            t('m.official.withdrawnBody', { date: formatDate(statement.withdrawnAt, language) }),
            withdrawalReason ? `${t('m.official.withdrawnReason')}: ${withdrawalReason}` : null,
          ]
            .filter(Boolean)
            .join('\n')}
        </Notice>
      ) : null}

      <SurfaceCard style={styles.card}>
        <AppText step="body">{localized(latest.bodyEn, latest.bodyTa)}</AppText>
        <OfficialImage revision={latest} />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <DetailRow label={t('m.official.checkCode')} value={statement.checkCode} mono />
        <DetailRow label={t('m.official.signingKey')} value={latest.keyId} mono />
        <Button
          label={t('m.official.shareLink')}
          variant="secondary"
          icon="share-outline"
          onPress={() => void Share.share({ message: t('m.official.shareMessage', { link: statement.checkLink }) })}
        />
      </SurfaceCard>

      <RevisionHistory revisions={statement.revisions} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
});
