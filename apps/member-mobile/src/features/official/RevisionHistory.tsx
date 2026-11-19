import type { OfficialRevision } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDateTime, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';

import { OfficialImage } from './OfficialImage';

/**
 * FR-AUT-004, BR-150: every signed version, newest first. A correction shows its reason; the
 * original stays exactly as it was signed. Each version's own signature is checked.
 */
export function RevisionHistory({ revisions }: { revisions: OfficialRevision[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const newestFirst = [...revisions].reverse();

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.official.history')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.official.historyIntro')}
      </AppText>
      {newestFirst.map((revision, index) => {
        const reason =
          revision.correctionReasonEn !== null
            ? localized(revision.correctionReasonEn, revision.correctionReasonTa ?? '')
            : null;
        return (
          <View key={revision.id} style={[styles.revision, index > 0 && styles.divider]}>
            <View style={styles.heading}>
              <AppText step="card" style={styles.flex}>
                {revision.revision === 1
                  ? t('m.official.original')
                  : t('m.official.correctionNumber', { number: revision.revision - 1 })}
              </AppText>
              <StatusTag
                tone={revision.verified ? 'verified' : 'error'}
                label={revision.verified ? t('m.official.signatureVerified') : t('m.official.notVerifiedLabel')}
              />
            </View>
            <AppText step="caption" tone="muted">
              {t('m.official.publishedOn', { date: formatDateTime(revision.publishedAt, language) })}
            </AppText>
            {reason ? <DetailRow label={t('m.official.correctionReason')} value={reason} /> : null}
            <AppText step="body">{localized(revision.titleEn, revision.titleTa)}</AppText>
            <AppText step="secondary" tone="secondary">
              {localized(revision.bodyEn, revision.bodyTa)}
            </AppText>
            <OfficialImage revision={revision} />
            <AppText step="caption" tone="muted">
              {t('m.official.publishedBy', { name: localized(revision.publisherNameEn, revision.publisherNameTa) })}
            </AppText>
          </View>
        );
      })}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  revision: { gap: spacing[2], paddingTop: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1, minWidth: 0 },
});
