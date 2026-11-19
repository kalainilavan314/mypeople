import type { CommitteeRole, CommitteeRosterEntry } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { ROLES } from '../labels';
import { committeeErrorMessage } from './committeeErrors';

const REASON_MIN = 3;

/**
 * S18: the roster with names, member codes and roles only (RB-09). A coordinator changes roles
 * (FR-COM-003, each change logged with them) or removes someone with a reason; access ends at once.
 */
export function RosterCard({
  committeeId,
  roster,
  canManage,
  onChanged,
}: {
  committeeId: string;
  roster: CommitteeRosterEntry[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.committees.roster', { count: roster.length })}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('s.committees.rosterHint')}
      </AppText>
      {roster.map((entry) => (
        <RosterEntry key={entry.id} committeeId={committeeId} entry={entry} canManage={canManage} onChanged={onChanged} />
      ))}
    </SurfaceCard>
  );
}

function RosterEntry({
  committeeId,
  entry,
  canManage,
  onChanged,
}: {
  committeeId: string;
  entry: CommitteeRosterEntry;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'role' | 'remove' | null>(null);
  const [role, setRole] = useState<CommitteeRole>(entry.role ?? 'member');
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);
  const change = useApiAction(async () => {
    await api().setCommitteeRole(committeeId, entry.id, role);
    setMode(null);
    onChanged();
  });
  const remove = useApiAction(async () => {
    await api().removeCommitteeMember(committeeId, entry.id, reason.trim());
    onChanged();
  });
  const failed = change.error ?? remove.error;

  return (
    <View style={styles.entry}>
      <View style={styles.head}>
        <View style={styles.text}>
          <AppText step="card">{entry.name}</AppText>
          <AppText step="secondary" tone="muted" mono>
            {entry.memberCode}
          </AppText>
        </View>
        {entry.role ? <StatusTag tone="neutral" label={t(`m.committees.role_${entry.role}`)} /> : null}
      </View>
      {failed ? <Notice tone="error">{committeeErrorMessage(t, failed)}</Notice> : null}
      {canManage && mode === null ? (
        <View style={styles.actions}>
          <Button variant="secondary" label={t('s.committees.changeRole')} onPress={() => setMode('role')} />
          <Button variant="quiet" label={t('s.committees.remove')} onPress={() => setMode('remove')} />
        </View>
      ) : null}
      {mode === 'role' ? (
        <>
          <ChipRow
            label={t('s.committees.changeRole')}
            selected={role}
            onSelect={setRole}
            options={ROLES.map((key) => ({ key, label: t(`m.committees.role_${key}`) }))}
          />
          <Button label={t('s.committees.saveRole')} busy={change.busy} onPress={() => void change.run()} />
          <Button variant="quiet" label={t('s.common.cancel')} onPress={() => setMode(null)} />
        </>
      ) : null}
      {mode === 'remove' ? (
        <>
          <TextField
            label={t('s.committees.removeReason')}
            hint={t('s.common.reasonHint')}
            value={reason}
            maxLength={500}
            onChangeText={setReason}
            error={showError && reason.trim().length < REASON_MIN ? t('s.committees.reasonRequired') : null}
          />
          <Button
            variant="danger"
            label={t('s.committees.remove')}
            busy={remove.busy}
            onPress={() => {
              if (reason.trim().length < REASON_MIN) {
                setShowError(true);
                return;
              }
              void remove.run();
            }}
          />
          <Button variant="quiet" label={t('s.common.cancel')} onPress={() => setMode(null)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  entry: { gap: spacing[2], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.divider },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  text: { flex: 1, minWidth: 0 },
  actions: { gap: spacing[2] },
});
