import type { CommitteeSpace } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { STATE_TONES } from './labels';

const NOTE_MAX = 500;

/**
 * Where the member stands with a committee they are not (yet) an approved member of: why they
 * cannot apply, the application form, a waiting application, or a past decision (FR-COM-002).
 */
export function MembershipPanel({ space, onChanged }: { space: CommitteeSpace; onChanged: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const membership = space.myMembership;
  const committeeId = space.committee.id;
  const apply = useApiAction(async () => {
    await api().applyToCommittee(committeeId, note.trim() || undefined);
    setNote('');
    onChanged();
  });
  const withdraw = useApiAction(async () => {
    await api().leaveCommittee(committeeId);
    onChanged();
  });

  if (space.committee.state !== 'active') {
    return <Notice tone="info">{t('m.committees.closedBody')}</Notice>;
  }

  if (membership?.state === 'applied') {
    return (
      <SurfaceCard style={styles.card}>
        <StatusTag tone={STATE_TONES.applied} label={t('m.committees.state_applied')} />
        <AppText step="body" tone="secondary">
          {t('m.committees.waitingBody')}
        </AppText>
        {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error, 'committees')}</Notice> : null}
        <Button
          variant="secondary"
          label={t('m.committees.withdraw')}
          busy={withdraw.busy}
          onPress={async () => {
            const sure = await confirmAction({
              title: t('m.committees.withdraw'),
              message: t('m.committees.withdrawConfirm'),
              confirmLabel: t('m.committees.withdraw'),
              cancelLabel: t('m.common.cancel'),
            });
            if (sure) void withdraw.run();
          }}
        />
      </SurfaceCard>
    );
  }

  const past = membership && membership.state !== 'approved' ? membership : null;
  return (
    <SurfaceCard style={styles.card}>
      {past ? (
        <View style={styles.past}>
          <StatusTag tone={STATE_TONES[past.state]} label={t(`m.committees.state_${past.state}`)} />
          {past.state === 'removed' ? (
            <AppText step="body" tone="secondary">
              {t('m.committees.removedBody')}
            </AppText>
          ) : null}
          {past.decisionReason ? (
            <AppText step="secondary" tone="secondary">
              {t('m.committees.reason', { reason: past.decisionReason })}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {space.applyProblem ? (
        past?.state === 'removed' ? null : (
          <Notice tone="info" title={t('m.committees.cannotApply')}>
            {t(`m.committees.refusals.${space.applyProblem}`, { defaultValue: t('m.committees.cannotApplyBody') })}
          </Notice>
        )
      ) : (
        <View style={styles.form}>
          <AppText step="section" accessibilityRole="header">
            {past ? t('m.committees.applyAgain') : t('m.committees.apply')}
          </AppText>
          <AppText step="secondary" tone="muted">
            {t('m.committees.applyExplain')}
          </AppText>
          <TextField
            label={t('m.committees.applyNote')}
            hint={t('m.committees.applyNoteHint')}
            optional
            multiline
            textAlignVertical="top"
            maxLength={NOTE_MAX}
            value={note}
            onChangeText={setNote}
          />
          {apply.error ? <Notice tone="error">{errorMessage(t, apply.error, 'committees')}</Notice> : null}
          <Button
            label={past ? t('m.committees.applyAgain') : t('m.committees.apply')}
            icon="people-outline"
            busy={apply.busy}
            onPress={() => void apply.run()}
          />
        </View>
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  past: { gap: spacing[2] },
  form: { gap: spacing[2] },
});
