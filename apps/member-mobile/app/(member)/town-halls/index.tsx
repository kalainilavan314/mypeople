import type { TownHall } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDateTime,
  Screen,
  SegmentedControl,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { STATE_TONES } from '@/features/townhalls/labels';
import { api } from '@/lib/api';

type Shelf = 'upcoming' | 'live' | 'past';

function shelfOf(townHall: TownHall): Shelf | null {
  if (townHall.state === 'live') return 'live';
  if (townHall.state === 'scheduled') return 'upcoming';
  if (townHall.state === 'ended' || townHall.state === 'cancelled') return 'past';
  return null;
}

/** M21 Town halls: upcoming, live and past sessions where members ask the leaders questions. */
export default function TownHallsScreen() {
  const { t } = useTranslation();
  const townHalls = useApiQuery(() => api().listTownHalls());
  useReloadOnFocus(townHalls.reload);
  const [chosen, setChosen] = useState<Shelf | null>(null);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={townHalls.reload}
      refreshing={townHalls.loading && townHalls.data !== undefined}>
      <FeatureQueryView feature="townHalls" query={townHalls}>
        {(items) => {
          // Opens on what is live, if anything is.
          const shelf = chosen ?? (items.some((item) => item.state === 'live') ? 'live' : 'upcoming');
          const shown = items
            .filter((item) => shelfOf(item) === shelf)
            .sort((a, b) => (shelf === 'past' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
          return (
            <>
              <AppText step="body" tone="secondary">
                {t('m.townHalls.intro')}
              </AppText>
              <SegmentedControl
                label={t('m.townHalls.show')}
                selected={shelf}
                onSelect={setChosen}
                options={[
                  { key: 'upcoming', label: t('m.townHalls.upcoming') },
                  { key: 'live', label: t('m.townHalls.live') },
                  { key: 'past', label: t('m.townHalls.past') },
                ]}
              />
              {shown.length === 0 ? (
                <AppText step="secondary" tone="muted">
                  {t(`m.townHalls.empty_${shelf}`)}
                </AppText>
              ) : (
                <View style={styles.list}>
                  {shown.map((townHall) => (
                    <TownHallCard key={townHall.id} townHall={townHall} />
                  ))}
                </View>
              )}
            </>
          );
        }}
      </FeatureQueryView>
    </Screen>
  );
}

function TownHallCard({ townHall }: { townHall: TownHall }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(townHall.titleEn, townHall.titleTa);
  const when = formatDateTime(townHall.startsAt, language);
  const state = t(`m.townHalls.state_${townHall.state}`);
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/town-halls/[id]', params: { id: townHall.id } })}
      accessibilityLabel={`${title}. ${state}. ${when}`}
      accessibilityHint={t('m.townHalls.opensSession')}>
      <StatusTag tone={STATE_TONES[townHall.state]} label={state} />
      <AppText step="card">{title}</AppText>
      <AppText step="secondary" tone="secondary">
        {localized(townHall.speakersEn, townHall.speakersTa)}
      </AppText>
      <AppText step="caption" tone="muted">
        {`${when} · ${t(`m.townHalls.language_${townHall.language}`)}`}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
