import type { CommitteeRole, CommitteeRosterEntry } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  formatDate,
  Notice,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { ROLES } from '../labels';
import { committeeErrorMessage } from './committeeErrors';

const REASON_MIN = 3;

/** S18: applications waiting for the coordinator, approved with a role or declined with a reason (FR-COM-002, 003). */
export function ApplicationsCard({
  committeeId,
  applications,
  onChanged,
}: {
  committeeId: string;
  applications: CommitteeRosterEntry[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.committees.applications')}
      </AppText>
      {applications.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('s.committees.noApplications')}
        </AppText>
      ) : (
        applications.map((entry) => (
          <Application key={entry.id} committeeId={committeeId} entry={entry} onChanged={onChanged} />
        ))
      )}
    </SurfaceCard>
  );
}

function Application({ committeeId, entry, onChanged }: { committeeId: string; entry: CommitteeRosterEntry; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [role, setRole] = useState<CommitteeRole>('member');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);
  const decide = useApiAction(async (approve: boolean) => {
    await api().decideCommitteeApplication(committeeId, entry.id, approve, role, approve ? undefined : reason.trim());
    onChanged();
  });
  const short = reason.trim().length < REASON_MIN;

  return (
    <View style={styles.entry}>
      <AppText step="card">{entry.name}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {entry.memberCode}
      </AppText>
      <AppText step="caption" tone="muted">
        {t('s.committees.appliedOn', { date: formatDate(entry.appliedAt, language) })}
      </AppText>
      {entry.applicationNote ? (
        <AppText step="secondary" tone="secondary">
          {t('s.committees.note', { note: entry.applicationNote })}
        </AppText>
      ) : null}
      {declining ? (
        <>
          <TextField
            label={t('s.committees.declineReason')}
            hint={t('s.committees.reasonHint')}
            value={reason}
            maxLength={500}
            onChangeText={setReason}
            error={showError && short ? t('s.committees.reasonRequired') : null}
          />
          {decide.error ? <Notice tone="error">{committeeErrorMessage(t, decide.error)}</Notice> : null}
          <Button
            variant="danger"
            label={t('s.committees.decline')}
            busy={decide.busy}
            onPress={() => {
              if (short) {
                setShowError(true);
                return;
              }
              void decide.run(false);
            }}
          />
          <Button variant="quiet" label={t('s.common.cancel')} onPress={() => setDeclining(false)} />
        </>
      ) : (
        <>
          <AppText step="label">{t('s.committees.approveAs')}</AppText>
          <ChipRow
            label={t('s.committees.approveAs')}
            selected={role}
            onSelect={setRole}
            options={ROLES.map((key) => ({ key, label: t(`m.committees.role_${key}`) }))}
          />
          {decide.error ? <Notice tone="error">{committeeErrorMessage(t, decide.error)}</Notice> : null}
          <Button
            icon="checkmark-circle-outline"
            label={t('s.committees.approve')}
            busy={decide.busy}
            onPress={() => void decide.run(true)}
          />
          <Button variant="secondary" label={t('s.committees.decline')} onPress={() => setDeclining(true)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  entry: { gap: spacing[2], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.divider },
});
