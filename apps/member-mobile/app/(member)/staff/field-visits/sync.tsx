import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useLanguage,
  useMember,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FieldAccess } from '@/features/staff/fieldVisits/FieldAccess';
import { encryptedOnDevice } from '@/features/staff/fieldVisits/secureChunks';
import { syncPending, type SyncReport } from '@/features/staff/fieldVisits/syncVisits';
import { usePlaceOptions } from '@/features/staff/fieldVisits/usePlaceOptions';
import { removeVisit, saveVisit, useLocalVisits, type LocalVisit } from '@/features/staff/fieldVisits/visitStore';
import { errorMessage } from '@/features/staff/errors';

/**
 * S07 Sync: sends the visits waiting on this phone and shows what happened to each. Notes that record
 * how someone votes, their party or persuasion must be edited; notes that only look political can
 * also be confirmed as not political. A conflict shows the coordinator's notes beside the server's,
 * to keep one or the other; a visit the server already holds as it is leaves the phone.
 */
export default function FieldSyncScreen() {
  return (
    <FieldAccess>
      <SyncBody />
    </FieldAccess>
  );
}

function SyncBody() {
  const { t } = useTranslation();
  const member = useMember();
  const local = useLocalVisits(member.id);
  const { label } = usePlaceOptions();
  const [reports, setReports] = useState<SyncReport[]>([]);
  const sync = useApiAction(async (visits: LocalVisit[]) => {
    setReports(await syncPending(member.id, visits));
  });
  const resend = async (visit: LocalVisit) => {
    await saveVisit(member.id, visit);
    await sync.run([visit]);
  };
  const waiting = local?.filter((visit) => visit.status === 'pending') ?? [];
  const attention = local?.filter((visit) => visit.status !== 'pending') ?? [];

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <AppText step="secondary" tone="muted">
        {encryptedOnDevice ? t('s.fieldVisits.encrypted') : t('s.fieldVisits.webMemoryOnly')}
      </AppText>
      <SurfaceCard style={styles.card}>
        <AppText step="body">{t('s.fieldVisits.readyCount', { count: waiting.length })}</AppText>
        <Button
          label={t('s.fieldVisits.syncNow')}
          icon="sync-outline"
          busy={sync.busy}
          disabled={waiting.length === 0}
          onPress={() => void sync.run(waiting)}
        />
        {sync.error ? <Notice tone="error">{`${errorMessage(t, sync.error)}\n${t('s.fieldVisits.keptOnPhone')}`}</Notice> : null}
      </SurfaceCard>

      {reports.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('s.fieldVisits.results')}
          </AppText>
          {reports.map((report) => (
            <View key={report.clientId} style={styles.row}>
              <StatusTag
                tone={report.outcome === 'refused' || report.outcome === 'conflict' ? 'error' : 'verified'}
                label={t(`s.fieldVisits.outcome_${report.outcome}`)}
              />
              {report.visitRef ? (
                <AppText step="secondary" tone="muted" mono>
                  {report.version !== null ? t('s.fieldVisits.refVersion', { ref: report.visitRef, version: report.version }) : report.visitRef}
                </AppText>
              ) : null}
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {attention.map((visit) =>
        visit.status === 'conflict' ? (
          <ConflictCard
            key={visit.clientId}
            visit={visit}
            gnName={label({ gnCode: visit.gnCode || null, dsCode: visit.dsCode || null })}
            busy={sync.busy}
            onKeepMine={() => void resend({ ...visit, status: 'pending', baseVersion: visit.server?.version ?? visit.baseVersion, server: null })}
            onUseServer={() => void removeVisit(member.id, visit.clientId)}
          />
        ) : (
          <RefusedCard
            key={visit.clientId}
            visit={visit}
            gnName={label({ gnCode: visit.gnCode || null, dsCode: visit.dsCode || null })}
            busy={sync.busy}
            onConfirm={() => void resend({ ...visit, status: 'pending', problems: [], confirmedNotPolitical: true })}
            onDelete={async () => {
              const yes = await confirmAction({
                title: t('s.fieldVisits.deleteTitle'),
                message: t('s.fieldVisits.deleteBody'),
                confirmLabel: t('s.fieldVisits.delete'),
                cancelLabel: t('s.common.cancel'),
                destructive: true,
              });
              if (yes) await removeVisit(member.id, visit.clientId);
            }}
          />
        ),
      )}
    </Screen>
  );
}

function VisitHeading({ visit, gnName }: { visit: LocalVisit; gnName: string }) {
  const language = useLanguage();
  return (
    <>
      <AppText step="card">{gnName}</AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(visit.visitedAt, language)}
      </AppText>
    </>
  );
}

type RefusedProps = { visit: LocalVisit; gnName: string; busy: boolean; onConfirm: () => void; onDelete: () => void };

function RefusedCard({ visit, gnName, busy, onConfirm, onDelete }: RefusedProps) {
  const { t } = useTranslation();
  // Words that only look political may be confirmed; a vote, a party or persuasion must be removed.
  const political = visit.problems.includes('political_content') && !visit.problems.includes('political_profiling');
  const editNotes = political || visit.problems.includes('political_profiling');
  return (
    <SurfaceCard style={styles.card}>
      <VisitHeading visit={visit} gnName={gnName} />
      <StatusTag tone="error" label={t('s.fieldVisits.local_refused')} />
      {visit.problems.map((problem) => (
        <AppText key={problem} step="secondary" tone="error">
          {t(`s.fieldVisits.problem_${problem}`, { defaultValue: t('s.fieldVisits.problem_other') })}
        </AppText>
      ))}
      <Button
        label={editNotes ? t('s.fieldVisits.editNotes') : t('s.fieldVisits.editVisit')}
        variant="secondary"
        icon="create-outline"
        disabled={busy}
        onPress={() => router.push({ pathname: '/staff/field-visits/new', params: { clientId: visit.clientId } })}
      />
      {political ? (
        <Button label={t('s.fieldVisits.confirmNotPolitical')} variant="secondary" icon="checkmark" busy={busy} onPress={onConfirm} />
      ) : null}
      <Button label={t('s.fieldVisits.delete')} variant="quiet" disabled={busy} onPress={onDelete} />
    </SurfaceCard>
  );
}

type ConflictProps = { visit: LocalVisit; gnName: string; busy: boolean; onKeepMine: () => void; onUseServer: () => void };

function ConflictCard({ visit, gnName, busy, onKeepMine, onUseServer }: ConflictProps) {
  const { t } = useTranslation();
  const concerns = (keys: readonly string[]) =>
    keys.map((key) => t(`s.fieldVisits.concern_${key}`, { defaultValue: key })).join(', ') || t('s.fieldVisits.none');
  const server = visit.server;
  return (
    <SurfaceCard style={styles.card}>
      <VisitHeading visit={visit} gnName={gnName} />
      <StatusTag tone="error" label={t('s.fieldVisits.local_conflict')} />
      <AppText step="secondary" tone="secondary">
        {t('s.fieldVisits.conflictExplain')}
      </AppText>
      <View style={styles.compare}>
        <AppText step="label">{t('s.fieldVisits.mine')}</AppText>
        <DetailRow label={t('s.fieldVisits.concerns')} value={concerns(visit.concerns)} />
        <DetailRow label={t('s.fieldVisits.notes')} value={visit.notes.trim() || t('s.fieldVisits.none')} />
        <DetailRow label={t('s.fieldVisits.followUp')} value={visit.followUp.trim() || t('s.fieldVisits.none')} />
      </View>
      {server ? (
        <View style={styles.compare}>
          <AppText step="label">{t('s.fieldVisits.servers', { version: server.version })}</AppText>
          <DetailRow label={t('s.fieldVisits.concerns')} value={concerns(server.concerns)} />
          <DetailRow label={t('s.fieldVisits.notes')} value={server.notes ?? t('s.fieldVisits.none')} />
          <DetailRow label={t('s.fieldVisits.followUp')} value={server.followUp ?? t('s.fieldVisits.none')} />
        </View>
      ) : null}
      <Button label={t('s.fieldVisits.keepMine')} icon="arrow-up-outline" busy={busy} onPress={onKeepMine} />
      <Button label={t('s.fieldVisits.useServers')} variant="secondary" icon="cloud-done-outline" disabled={busy} onPress={onUseServer} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  row: { gap: 2, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
  compare: { gap: spacing[1], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
});
