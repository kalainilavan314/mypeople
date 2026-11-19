import type { OfficialStatement } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { OfficialStatusTag } from './OfficialStatusTag';

/** One statement in M47: its label, title, publisher and date, and how often it was corrected; opens its history. */
export function OfficialStatementCard({ statement }: { statement: OfficialStatement }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const latest = statement.latest;
  const title = localized(latest.titleEn, latest.titleTa);
  const publisher = t('m.official.publishedBy', { name: localized(latest.publisherNameEn, latest.publisherNameTa) });
  const published = t('m.official.publishedOn', { date: formatDate(statement.firstPublishedAt, language) });
  const label = !statement.signed
    ? t('m.official.notVerifiedLabel')
    : statement.state === 'withdrawn'
      ? t('m.official.withdrawnLabel')
      : t('m.official.officialLabel');
  const corrections = statement.revisionCount > 1 ? t('m.official.corrections', { count: statement.revisionCount - 1 }) : null;

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/official/updates/[id]', params: { id: statement.id } })}
      accessibilityLabel={[label, title, publisher, published, corrections].filter(Boolean).join('. ')}
      accessibilityHint={t('m.official.opensStatement')}
      style={styles.card}>
      <View style={styles.tags}>
        <OfficialStatusTag state={statement.state} signed={statement.signed} />
      </View>
      <AppText step="card">{title}</AppText>
      <AppText step="secondary" tone="secondary" numberOfLines={3}>
        {localized(latest.bodyEn, latest.bodyTa)}
      </AppText>
      <AppText step="caption" tone="muted">
        {[publisher, published, corrections].filter(Boolean).join(' · ')}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
