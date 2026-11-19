import type { GuideEntrySummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, IconTile, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { CATEGORY_ICONS } from './labels';

/** One entry in M39: its category, title, provider, summary and the dates that say how fresh it is. */
export function GuideEntryCard({ entry }: { entry: GuideEntrySummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(entry.titleEn, entry.titleTa);
  const category = t(`m.livelihood.category_${entry.category}`);
  const provider = localized(entry.providerEn, entry.providerTa);
  const checked = t('m.livelihood.checkedOn', { date: formatDate(entry.verifiedOn, language) });
  const closes = entry.expiresOn ? t('m.livelihood.closesOn', { date: formatDate(entry.expiresOn, language) }) : null;

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/livelihood/[id]', params: { id: entry.id } })}
      accessibilityLabel={[title, category, provider, checked, closes].filter(Boolean).join('. ')}
      accessibilityHint={t('m.livelihood.opensEntry')}>
      <View style={styles.row}>
        <IconTile icon={CATEGORY_ICONS[entry.category]} tint="green" size={40} />
        <View style={styles.text}>
          <AppText step="caption" tone="secondary">
            {category}
          </AppText>
          <AppText step="card">{title}</AppText>
          <AppText step="secondary" tone="secondary">
            {provider}
          </AppText>
        </View>
      </View>
      <AppText step="body" tone="secondary" numberOfLines={3}>
        {localized(entry.summaryEn, entry.summaryTa)}
      </AppText>
      <AppText step="caption" tone="muted">
        {closes ? `${checked} · ${closes}` : checked}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
