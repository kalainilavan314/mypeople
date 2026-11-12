import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatTime,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** S09: expected (going) and attended, with each check-in marked scanned or manual (FR-STF-006). */
export default function RosterScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roster = useApiQuery(() => api().getEventAttendance(id), [id]);
  useReloadOnFocus(roster.reload);

  return (
    <Screen edges={['bottom']} onRefresh={roster.reload} refreshing={roster.loading && roster.data !== undefined}>
      <QueryView query={roster}>
        {(data) => (
          <>
            <View style={styles.counts}>
              <SurfaceCard style={styles.count}>
                <AppText step="caption" tone="muted">
                  {t('s.checkIn.expected')}
                </AppText>
                <AppText step="page">{String(data.expected)}</AppText>
              </SurfaceCard>
              <SurfaceCard style={styles.count}>
                <AppText step="caption" tone="muted">
                  {t('s.checkIn.attended')}
                </AppText>
                <AppText step="page">{String(data.attended)}</AppText>
              </SurfaceCard>
            </View>
            {data.entries.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('s.common.empty')}
              </AppText>
            ) : null}
            {data.entries.map((entry) => (
              <SurfaceCard key={entry.memberId}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AppText step="card">{entry.fullName}</AppText>
                    <AppText step="caption" tone="muted" mono>
                      {entry.memberCode}
                    </AppText>
                  </View>
                  {entry.attendedAt ? (
                    <StatusTag
                      tone="verified"
                      label={`${entry.checkinMethod === 'manual' ? t('s.checkIn.manual') : t('s.checkIn.scanned')} ${formatTime(entry.attendedAt, language)}`}
                    />
                  ) : (
                    <StatusTag tone="neutral" label={t('s.checkIn.notYet')} />
                  )}
                </View>
              </SurfaceCard>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: 'row', gap: spacing[3] },
  count: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
