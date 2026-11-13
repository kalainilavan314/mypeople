import type { FieldVisit } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useMember,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { FieldAccess } from '@/features/staff/fieldVisits/FieldAccess';
import { encryptedOnDevice } from '@/features/staff/fieldVisits/secureChunks';
import { useGnOptions } from '@/features/staff/fieldVisits/useGnOptions';
import { useLocalVisits, type LocalVisit } from '@/features/staff/fieldVisits/visitStore';
import { api } from '@/lib/api';
import { featureClosed } from '@/lib/errors';

/** S05 My field visits: those waiting on this phone with their sync state, and those the server holds. */
export default function FieldVisitsScreen() {
  return (
    <FieldAccess>
      <FieldVisitsBody />
    </FieldAccess>
  );
}

function FieldVisitsBody() {
  const { t } = useTranslation();
  const language = useLanguage();
  const member = useMember();
  const local = useLocalVisits(member.id);
  const { label } = useGnOptions();
  const synced = useApiQuery(() => api().listMyFieldVisits());
  useReloadOnFocus(synced.reload);
  const waiting = local?.filter((visit) => visit.status === 'pending').length ?? 0;
  const needsAction = local?.filter((visit) => visit.status !== 'pending').length ?? 0;

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={synced.reload} refreshing={synced.loading && synced.data !== undefined}>
      <Notice tone="warning">{t('s.fieldVisits.noPolitics')}</Notice>
      <Button label={t('s.fieldVisits.newVisit')} icon="add-circle-outline" onPress={() => router.push('/staff/field-visits/new')} />

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('s.fieldVisits.onThisPhone')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {encryptedOnDevice ? t('s.fieldVisits.encrypted') : t('s.fieldVisits.webMemoryOnly')}
        </AppText>
        {local === null ? null : local.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('s.fieldVisits.nothingWaiting')}
          </AppText>
        ) : (
          <>
            <AppText step="body">{t('s.fieldVisits.waitingCount', { waiting, action: needsAction })}</AppText>
            {local.map((visit) => (
              <LocalRow key={visit.clientId} visit={visit} gnName={label(visit.gnCode)} />
            ))}
          </>
        )}
        <Button
          label={t('s.fieldVisits.openSync')}
          variant="secondary"
          icon="sync-outline"
          onPress={() => router.push('/staff/field-visits/sync')}
        />
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('s.fieldVisits.synced')}
      </AppText>
      {synced.data === undefined && !synced.loading && featureClosed(synced.error) ? (
        <Notice tone="info">{t('s.fieldVisits.notOpen')}</Notice>
      ) : (
        <QueryView query={synced}>
          {(items) =>
            items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('s.fieldVisits.noneSynced')}
              </AppText>
            ) : (
              <View style={styles.list}>
                {items.map((visit) => (
                  <SyncedRow key={visit.id} visit={visit} gnName={label(visit.gnCode)} language={language} />
                ))}
              </View>
            )
          }
        </QueryView>
      )}
    </Screen>
  );
}

function LocalRow({ visit, gnName }: { visit: LocalVisit; gnName: string }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const tone = visit.status === 'pending' ? 'pending' : 'error';
  return (
    <View style={styles.row}>
      <AppText step="card">{gnName}</AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(visit.visitedAt, language)}
      </AppText>
      <StatusTag tone={tone} label={t(`s.fieldVisits.local_${visit.status}`)} />
    </View>
  );
}

function SyncedRow({ visit, gnName, language }: { visit: FieldVisit; gnName: string; language: string }) {
  const { t } = useTranslation();
  return (
    <SurfaceCard>
      <AppText step="card">{gnName}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {visit.visitRef}
      </AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(visit.visitedAt, language)}
      </AppText>
      <StatusTag tone="verified" label={t('s.fieldVisits.syncedVersion', { version: visit.version })} />
      {visit.consent === 'declined' ? (
        <AppText step="secondary" tone="secondary">
          {t('s.fieldVisits.declinedRecord')}
        </AppText>
      ) : (
        <AppText step="secondary" tone="secondary">
          {visit.concerns.map((concern) => t(`s.fieldVisits.concern_${concern}`, { defaultValue: concern })).join(', ')}
        </AppText>
      )}
      {visit.followUp ? (
        <AppText step="secondary" tone="secondary">
          {visit.followUpDoneAt ? t('s.fieldVisits.followUpDone') : t('s.fieldVisits.followUpOpen', { text: visit.followUp })}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  list: { gap: spacing[3] },
  row: { gap: 2, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
});
