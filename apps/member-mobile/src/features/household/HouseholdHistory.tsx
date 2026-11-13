import type { HouseholdLogEntry } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDateTime, SurfaceCard, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/**
 * M10: every change to the household, for its confirmed adults: what changed, who and when.
 * A caseworker is never named, and someone who has left is shown only as a former member.
 */
export function HouseholdHistory({ version }: { version: string }) {
  const { t } = useTranslation();
  const query = useApiQuery(() => api().getHouseholdLog(), [version]);

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{t('m.household.consentLogs')}</AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.household.historyIntro')}
      </AppText>
      <QueryView query={query}>
        {(entries) =>
          entries.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.household.noHistory')}
            </AppText>
          ) : (
            <View>
              {entries.map((entry, index) => (
                <HistoryRow key={entry.id} entry={entry} divided={index > 0} />
              ))}
            </View>
          )
        }
      </QueryView>
    </SurfaceCard>
  );
}

function HistoryRow({ entry, divided }: { entry: HouseholdLogEntry; divided: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const who =
    entry.actor === 'household_member' && entry.actorName
      ? entry.actorName
      : t(`m.household.logActors.${entry.actor === 'household_member' ? 'former_member' : entry.actor}`);
  return (
    <View style={[styles.row, divided && styles.divider]}>
      <AppText step="body">{t(`m.household.logActions.${entry.action}`)}</AppText>
      <AppText step="secondary" tone="muted">
        {`${who} · ${formatDateTime(entry.createdAt, language)}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  row: { paddingVertical: spacing[2], gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
