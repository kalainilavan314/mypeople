import type { ReliefDistribution, ReliefItem, ReliefStock } from '@my-people/api-client';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

/**
 * S16 Relief distribution record: the stock of each store in the officer's areas and what was handed out
 * lately. Recipients are an AS- case or a group at a site, never a name, under the same neutrality
 * firewall as Community Support (FR-DIS-005). The API checks relief.logistics and the area each time.
 */
export default function StaffReliefScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const overview = useApiQuery(async () => (permissions.has('relief.logistics') ? api().getReliefOverview() : null), [permissions]);
  const given = useApiQuery(async () => (permissions.has('relief.logistics') ? api().listReliefDistributions() : null), [permissions]);
  const reload = useCallback(() => {
    overview.reload();
    given.reload();
  }, [overview.reload, given.reload]);
  useReloadOnFocus(reload);

  if (!permissions.has('relief.logistics')) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.relief.noAccess')}</Notice>
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={reload} refreshing={overview.loading && overview.data !== undefined}>
      <Notice tone="info" title={t('s.relief.neutralTitle')}>
        {t('s.relief.neutralBody')}
      </Notice>
      <Button label={t('s.relief.record')} icon="add-circle-outline" onPress={() => router.push('/staff/relief/record')} />
      <QueryView query={overview}>
        {(data) =>
          data ? (
            <View style={styles.list}>
              <AppText step="section" accessibilityRole="header">
                {t('s.relief.stockHeading')}
              </AppText>
              {data.stock.length === 0 ? (
                <AppText step="secondary" tone="muted">
                  {t('s.relief.noStock')}
                </AppText>
              ) : (
                <StockList stock={data.stock} items={data.items} />
              )}
            </View>
          ) : null
        }
      </QueryView>
      <QueryView query={given}>
        {(rows) =>
          rows ? (
            <View style={styles.list}>
              <AppText step="section" accessibilityRole="header">
                {t('s.relief.recentHeading')}
              </AppText>
              {rows.length === 0 ? (
                <AppText step="secondary" tone="muted">
                  {t('s.relief.noDistributions')}
                </AppText>
              ) : (
                rows.slice(0, 30).map((row) => <DistributionRow key={row.id} row={row} items={overview.data?.items ?? []} />)
              )}
            </View>
          ) : null
        }
      </QueryView>
    </Screen>
  );
}

function StockList({ stock, items }: { stock: ReliefStock[]; items: ReliefItem[] }) {
  const stores = [...new Set(stock.map((line) => line.storeKey))];
  return (
    <>
      {stores.map((store) => (
        <StoreCard key={store} store={store} lines={stock.filter((line) => line.storeKey === store)} items={items} />
      ))}
    </>
  );
}

function StoreCard({ store, lines, items }: { store: string; lines: ReliefStock[]; items: ReliefItem[] }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const name = useAreaName(store);
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{t('s.relief.store', { area: name ?? store })}</AppText>
      {lines.map((line) => {
        const item = items.find((candidate) => candidate.key === line.item);
        const unit = t(`s.relief.unit_${line.unit}`);
        return (
          <View key={line.item} style={styles.line}>
            <AppText step="secondary" style={styles.flex}>
              {item ? localized(item.nameEn, item.nameTa) : line.item}
            </AppText>
            <AppText step="secondary" tone={line.balance > 0 ? 'default' : 'muted'} style={styles.amount}>
              {t('s.relief.balance', { balance: line.balance, unit })}
            </AppText>
          </View>
        );
      })}
    </SurfaceCard>
  );
}

function DistributionRow({ row, items }: { row: ReliefDistribution; items: ReliefItem[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const place = useAreaName(row.areaKey);
  const item = items.find((candidate) => candidate.key === row.item);
  const recipient =
    row.recipientKind === 'case'
      ? t('s.relief.toCase', { ref: row.caseRef ?? '' })
      : t('s.relief.toGroup', { site: row.groupSite ?? '', households: row.households ?? 0 });
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.line}>
        <AppText step="card" mono style={styles.flex}>
          {row.distributionRef}
        </AppText>
        <StatusTag tone="neutral" label={formatDate(row.deliveredOn, language)} />
      </View>
      <AppText step="secondary">
        {`${row.quantity} ${t(`s.relief.unit_${row.unit}`)} · ${item ? localized(item.nameEn, item.nameTa) : row.item}`}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {`${recipient} · ${place ?? row.areaKey}`}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing[1],
  },
  flex: { flex: 1, minWidth: 0 },
  amount: { flexShrink: 0 },
});
