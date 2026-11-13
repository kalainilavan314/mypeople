import type { MyIssueAddition } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { issueErrorMessage } from './issueErrors';

const APPEAL_MIN = 10;
const APPEAL_MAX = 1000;

/**
 * What this member added to the issue and where each stands: waiting for a moderator, published, or
 * not published with the moderator's reason. A rejection may be appealed once; another moderator
 * decides and the member sees the outcome and the reason here (D12). Only the member sees this.
 */
export function MyAdditions({ additions, reload }: { additions: MyIssueAddition[]; reload: () => void }) {
  const { t } = useTranslation();
  if (additions.length === 0) return null;
  return (
    <>
      <AppText step="section" accessibilityRole="header">
        {t('m.issues.myAdditionsTitle')}
      </AppText>
      <SurfaceCard style={styles.list}>
        {additions.map((addition, index) => (
          <AdditionItem key={addition.id} addition={addition} divider={index > 0} reload={reload} />
        ))}
      </SurfaceCard>
    </>
  );
}

function AdditionItem({ addition, divider, reload }: { addition: MyIssueAddition; divider: boolean; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const tag =
    addition.state === 'approved'
      ? { tone: 'verified' as const, label: t('m.issues.additionApproved') }
      : addition.state === 'rejected'
        ? { tone: 'error' as const, label: t('m.issues.additionRejected') }
        : { tone: 'pending' as const, label: t('m.issues.additionPending') };

  return (
    <View style={[styles.item, divider && styles.divider]}>
      <StatusTag tone={tag.tone} label={tag.label} />
      <AppText step="body">{addition.body}</AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(addition.createdAt, language)}
      </AppText>
      {addition.edited ? (
        <AppText step="secondary" tone="secondary">
          {t('m.issues.additionEdited')}
        </AppText>
      ) : null}
      {addition.moderationReason ? (
        <View style={styles.reason}>
          <AppText step="label">{t('m.issues.moderatorReason')}</AppText>
          <AppText step="secondary" tone="secondary">
            {addition.moderationReason}
          </AppText>
        </View>
      ) : null}
      {addition.appeal ? <AppealOutcome appeal={addition.appeal} /> : null}
      {addition.canAppeal ? <AppealForm additionId={addition.id} onSent={reload} /> : null}
    </View>
  );
}

function AppealOutcome({ appeal }: { appeal: NonNullable<MyIssueAddition['appeal']> }) {
  const { t } = useTranslation();
  const language = useLanguage();
  if (appeal.state === 'open') {
    return (
      <Notice tone="info" title={t('m.issues.appealWaitingTitle')}>
        <AppText step="secondary">{t('m.issues.appealWaitingBody')}</AppText>
      </Notice>
    );
  }
  const changed = appeal.state === 'changed';
  return (
    <Notice tone={changed ? 'success' : 'warning'} title={changed ? t('m.issues.appealChangedTitle') : t('m.issues.appealUpheldTitle')}>
      {appeal.reason ? <AppText step="secondary">{appeal.reason}</AppText> : null}
      {appeal.decidedAt ? (
        <AppText step="caption" tone="muted">
          {formatDateTime(appeal.decidedAt, language)}
        </AppText>
      ) : null}
    </Notice>
  );
}

/** One appeal per decision: the member says why, and another moderator looks again. */
function AppealForm({ additionId, onSent }: { additionId: string; onSent: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const length = body.trim().length;
  const invalid = length < APPEAL_MIN || length > APPEAL_MAX;
  const send = useApiAction(async () => {
    if (invalid) {
      setShowErrors(true);
      return;
    }
    await api().appealModeration({ itemKind: 'addition', itemId: additionId, body: body.trim() });
    onSent();
  });

  if (!open) {
    return <Button label={t('m.issues.appealOnce')} icon="arrow-undo-outline" variant="secondary" onPress={() => setOpen(true)} />;
  }
  return (
    <View style={styles.form}>
      <TextField
        label={t('m.issues.appealLabel')}
        hint={t('m.issues.appealHint')}
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
        maxLength={APPEAL_MAX}
        error={showErrors && invalid ? t('m.issues.appealError', { min: APPEAL_MIN }) : null}
      />
      {send.error ? <Notice tone="error">{issueErrorMessage(t, send.error)}</Notice> : null}
      <Button
        label={t('m.issues.sendAppeal')}
        icon="send-outline"
        busy={send.busy}
        busyLabel={t('m.common.sending')}
        onPress={() => void send.run()}
      />
      <Button label={t('m.common.cancel')} variant="quiet" disabled={send.busy} onPress={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { padding: spacing[4], gap: spacing[2] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  reason: { gap: 2 },
  form: { gap: spacing[3] },
});
