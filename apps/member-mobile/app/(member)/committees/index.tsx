import type { CommitteeCard as Card, CommitteeWingType } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  ChipRow,
  MenuRow,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CommitteeCard } from '@/features/committees/CommitteeCard';
import { WING_TYPES } from '@/features/committees/labels';
import { api } from '@/lib/api';

const ALL = 'all';

/**
 * M31 My committees: the member's own committees first, then the approved committees for their
 * area grouped by wing, each opening its space or its application (FR-COM-001, 002).
 */
export default function CommitteesScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [wing, setWing] = useState<CommitteeWingType | typeof ALL>(ALL);
  const committees = useApiQuery(() => api().listCommittees(wing === ALL ? undefined : wing), [wing]);
  // The coordinator tools appear only for someone who coordinates or is secretary somewhere.
  const coordinating = useApiQuery(() => api().listCoordinatedCommittees().catch(() => []), []);
  useReloadOnFocus(committees.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={() => {
        committees.reload();
        coordinating.reload();
      }}
      refreshing={committees.loading && committees.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.committees.intro')}
      </AppText>

      {coordinating.data && coordinating.data.length > 0 ? (
        <SurfaceCard style={styles.rowCard}>
          {coordinating.data.map((entry, index) => (
            <MenuRow
              key={entry.committee.id}
              first={index === 0}
              icon="clipboard-outline"
              tint="teal"
              label={t('m.committees.toolsFor', { name: localized(entry.committee.nameEn, entry.committee.nameTa) })}
              hint={t('m.committees.waitingCount', { count: entry.waiting })}
              onPress={() =>
                router.push({ pathname: '/committees/[id]/coordinate', params: { id: entry.committee.id } })
              }
            />
          ))}
        </SurfaceCard>
      ) : null}

      <View style={styles.filters}>
        <AppText step="label">{t('m.committees.filterWing')}</AppText>
        <ChipRow
          label={t('m.committees.filterWing')}
          selected={wing}
          onSelect={setWing}
          options={[
            { key: ALL, label: t('m.committees.all') },
            ...WING_TYPES.map((key) => ({ key, label: t(`m.committees.wing_${key}`) })),
          ]}
        />
      </View>

      <FeatureQueryView feature="committees" query={committees}>
        {(items) => <CommitteeLists items={items} />}
      </FeatureQueryView>
    </Screen>
  );
}

function CommitteeLists({ items }: { items: Card[] }) {
  const { t } = useTranslation();
  const mine = items.filter(
    (item) => item.kind === 'committee' && item.myMembership && ['applied', 'approved'].includes(item.myMembership.state),
  );
  const others = items.filter((item) => item.kind === 'committee' && !mine.includes(item) && item.state === 'active');

  return (
    <>
      <View style={styles.section}>
        <AppText step="section" accessibilityRole="header">
          {t('m.committees.mine')}
        </AppText>
        {mine.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('m.committees.noneMine')}
          </AppText>
        ) : (
          mine.map((item) => <CommitteeCard key={item.id} committee={item} />)
        )}
      </View>
      <View style={styles.section}>
        <AppText step="section" accessibilityRole="header">
          {t('m.committees.browse')}
        </AppText>
        {others.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('m.committees.none')}
          </AppText>
        ) : (
          others.map((item) => <CommitteeCard key={item.id} committee={item} />)
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rowCard: { paddingVertical: 0 },
  filters: { gap: spacing[2] },
  section: { gap: spacing[3] },
});
