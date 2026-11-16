import type { Place, PublicSupportStatistics } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, SurfaceCard, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

type Cell = PublicSupportStatistics['cells'][number];
type District = { key: string; name: string; cells: Cell[] };

/** The cells under each district, districts by name and requests without an area last. */
function byDistrict(cells: Cell[], districts: Place[] | undefined, language: string, noArea: string): District[] {
  const names = new Map(
    (districts ?? []).map((place) => [`district:${place.code}`, (language === 'ta' ? place.nameTa : place.nameEn) ?? place.nameEn ?? place.code]),
  );
  const groups = new Map<string, District>();
  for (const cell of cells) {
    const name = cell.areaKey === 'platform' ? noArea : (names.get(cell.areaKey) ?? cell.areaKey.replace(/^district:/, ''));
    const group = groups.get(cell.areaKey) ?? { key: cell.areaKey, name, cells: [] };
    group.cells.push(cell);
    groups.set(cell.areaKey, group);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.key === 'platform') - Number(b.key === 'platform') || a.name.localeCompare(b.name),
  );
}

/**
 * D14: requests received so far by district and kind of help, open to everyone. Only anonymised
 * counts reach the app: a group of fewer than 10 comes as null and reads "fewer than 10"
 * (FR-AST-012). While the figures cannot load, the section stays out of the way of the form.
 */
export function PublicStatistics() {
  const { t } = useTranslation();
  const language = useLanguage();
  const statistics = useApiQuery(() => api().getPublicSupportStatistics());
  const districts = useApiQuery(() => api().listDistricts());
  if (!statistics.data) return null;
  const { minimumGroup, cells } = statistics.data;
  const groups = byDistrict(cells, districts.data, language, t('m.support.noAreaGiven'));

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.support.statisticsTitle')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.support.statisticsNote', { min: minimumGroup })}
      </AppText>
      {groups.length === 0 ? (
        <AppText step="secondary" tone="secondary">
          {t('m.support.statisticsEmpty')}
        </AppText>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <AppText step="card" accessibilityRole="header">
              {group.name}
            </AppText>
            {group.cells.map((cell) => (
              <View key={cell.category} style={styles.row}>
                <AppText step="secondary" tone="secondary" style={styles.flex}>
                  {t(`m.support.category_${cell.category}`)}
                </AppText>
                <AppText step="secondary" mono={cell.count !== null}>
                  {cell.count === null ? t('m.support.fewerThan', { min: minimumGroup }) : String(cell.count)}
                </AppText>
              </View>
            ))}
          </View>
        ))
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  group: { gap: spacing[1], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
