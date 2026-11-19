import type { GuideCategory } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  ChipRow,
  Notice,
  Screen,
  SearchField,
  useApiQuery,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { GuideEntryCard } from '@/features/livelihood/GuideEntryCard';
import { GUIDE_CATEGORIES, isGuideCategory } from '@/features/livelihood/labels';
import { api } from '@/lib/api';

const ALL = 'all';
const SEARCH_PAUSE_MS = 400;

/**
 * M39 Livelihood and welfare guide: assistance programmes, scholarships, jobs, training, farming,
 * fishing, enterprise grants, courses and public-service contacts, searchable in Tamil or English
 * (FR-LIV-001). Only reviewed entries before their end date appear. The guide never says who
 * qualifies (FR-LIV-004): each entry sends people to the provider.
 */
export default function LivelihoodGuideScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<GuideCategory | typeof ALL>(
    isGuideCategory(params.category) ? params.category : ALL,
  );
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  // Searching waits for a short pause in typing, so each letter does not start a request.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), SEARCH_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  const entries = useApiQuery(
    () => api().searchGuide({ q: query || undefined, category: category === ALL ? undefined : category }),
    [query, category],
  );
  useReloadOnFocus(entries.reload);
  const filtered = query !== '' || category !== ALL;

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={entries.reload}
      refreshing={entries.loading && entries.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.livelihood.intro')}
      </AppText>
      <Notice tone="info" title={t('m.livelihood.checkEligibility')}>
        {t('m.livelihood.disclaimerShort')}
      </Notice>
      <SearchField
        label={t('m.livelihood.search')}
        value={typed}
        onChangeText={setTyped}
        returnKeyType="search"
        onSubmitEditing={() => setQuery(typed.trim())}
        maxLength={80}
        autoCorrect={false}
      />
      <View style={styles.filters}>
        <AppText step="label">{t('m.livelihood.category')}</AppText>
        <ChipRow
          label={t('m.livelihood.category')}
          selected={category}
          onSelect={setCategory}
          options={[
            { key: ALL, label: t('m.livelihood.all') },
            ...GUIDE_CATEGORIES.map((key) => ({ key, label: t(`m.livelihood.category_${key}`) })),
          ]}
        />
      </View>

      <FeatureQueryView feature="livelihood" query={entries}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {filtered ? t('m.livelihood.noMatch') : t('m.livelihood.none')}
            </AppText>
          ) : (
            <View style={styles.list}>
              <AppText step="caption" tone="muted" accessibilityLiveRegion="polite">
                {t('m.livelihood.count', { count: items.length })}
              </AppText>
              {items.map((entry) => (
                <GuideEntryCard key={entry.id} entry={entry} />
              ))}
            </View>
          )
        }
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing[2] },
  list: { gap: spacing[3] },
});
