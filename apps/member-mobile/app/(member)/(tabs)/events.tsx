import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

import { AppText, Button, ChipRow, Screen, SurfaceCard, TextField, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { EventRow } from '@/features/events/EventRow';
import { api } from '@/lib/api';

type Filter = 'mine' | 'all' | 'week' | 'month';

const DAY_MS = 24 * 60 * 60 * 1000;

function untilFor(filter: Filter): string | undefined {
  if (filter === 'week') return new Date(Date.now() + 7 * DAY_MS).toISOString();
  if (filter === 'month') return new Date(Date.now() + 31 * DAY_MS).toISOString();
  return undefined;
}

/**
 * E01: events still to come. "My area" is only the default and never hides
 * anything for good (BR-057); the list needs no map or location permission.
 */
export default function EventsScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('mine');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const events = useApiQuery(
    () => api().listEvents({ scope: filter === 'mine' ? 'mine' : 'all', until: untilFor(filter), q: query || undefined }),
    [filter, query],
  );
  useReloadOnFocus(events.reload);

  return (
    <Screen edges={[]} maxContentWidth={720} onRefresh={events.reload} refreshing={events.loading && events.data !== undefined}>
      <AppText step="secondary" tone="muted">
        {t('m.events.subtitle')}
      </AppText>
      <TextField
        label={t('m.events.search')}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => setQuery(search.trim())}
        onBlur={() => setQuery(search.trim())}
        returnKeyType="search"
        autoCorrect={false}
      />
      <ChipRow
        label={t('m.events.title')}
        selected={filter}
        onSelect={setFilter}
        options={[
          { key: 'mine', label: t('m.events.myArea') },
          { key: 'all', label: t('m.events.all') },
          { key: 'week', label: t('m.events.thisWeek') },
          { key: 'month', label: t('m.events.thisMonth') },
        ]}
      />
      <QueryView query={events}>
        {(list) => (
          <View style={styles.list} accessibilityLiveRegion="polite">
            {list.length === 0 ? (
              <SurfaceCard>
                <AppText step="secondary" tone="muted">
                  {filter === 'mine' ? t('m.events.emptyMine') : t('m.events.empty')}
                </AppText>
                {filter === 'mine' ? (
                  <Button label={t('m.events.showAll')} variant="secondary" onPress={() => setFilter('all')} />
                ) : null}
              </SurfaceCard>
            ) : (
              <AppText step="secondary" tone="muted">
                {t('m.events.results', { count: list.length })}
              </AppText>
            )}
            {list.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
