import type { GuideEntry } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  IconTile,
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CATEGORY_ICONS } from '@/features/livelihood/labels';
import { ReportOutdated } from '@/features/livelihood/ReportOutdated';
import { api } from '@/lib/api';

/**
 * M40 Guide entry detail: what is offered and by whom, the source link, when the provider published
 * it and when the team last checked it, the end date, and the eligibility disclaimer on every entry
 * (FR-LIV-002, 004). Anyone may report the entry as outdated (FR-LIV-006).
 */
export default function GuideEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useApiQuery(() => api().getGuideEntry(id), [id]);
  useReloadOnFocus(entry.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={entry.reload}
      refreshing={entry.loading && entry.data !== undefined}>
      <FeatureQueryView feature="livelihood" query={entry}>
        {(data) => <EntryBody entry={data} onReported={entry.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function EntryBody({ entry, onReported }: { entry: GuideEntry; onReported: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const provider = localized(entry.providerEn, entry.providerTa);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <IconTile icon={CATEGORY_ICONS[entry.category]} tint="green" />
          <View style={styles.headerText}>
            <AppText step="caption" tone="secondary">
              {t(`m.livelihood.category_${entry.category}`)}
            </AppText>
            <AppText step="page" accessibilityRole="header">
              {localized(entry.titleEn, entry.titleTa)}
            </AppText>
          </View>
        </View>
        <AppText step="secondary" tone="muted" mono>
          {entry.entryRef}
        </AppText>
        <AppText step="body" tone="secondary">
          {localized(entry.summaryEn, entry.summaryTa)}
        </AppText>
      </View>

      {/* FR-LIV-004: the same words on every entry; the guide never says who qualifies. */}
      <Notice tone="warning" title={t('m.livelihood.checkEligibility')}>
        {localized(entry.disclaimerEn, entry.disclaimerTa)}
      </Notice>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.livelihood.details')}
        </AppText>
        <AppText step="body">{localized(entry.bodyEn, entry.bodyTa)}</AppText>
        <DetailRow label={t('m.livelihood.provider')} value={provider} />
        {entry.contact ? <DetailRow label={t('m.livelihood.contact')} value={entry.contact} /> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.livelihood.source')}
        </AppText>
        <AppText step="secondary" tone="secondary" selectable>
          {entry.sourceUrl}
        </AppText>
        <Button
          label={t('m.livelihood.openSource')}
          icon="open-outline"
          variant="secondary"
          accessibilityHint={t('m.livelihood.openSourceHint')}
          onPress={() => void Linking.openURL(entry.sourceUrl)}
        />
        <DetailRow label={t('m.livelihood.publishedOn')} value={formatDate(entry.publishedOn, language)} />
        <DetailRow label={t('m.livelihood.verifiedOn')} value={formatDate(entry.verifiedOn, language)} />
        <DetailRow
          label={t('m.livelihood.endDate')}
          value={entry.expiresOn ? formatDate(entry.expiresOn, language) : t('m.livelihood.noEndDate')}
        />
      </SurfaceCard>

      <ReportOutdated entryId={entry.id} openReport={entry.myOpenReport ?? null} onReported={onReported} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  card: { gap: spacing[3] },
});
