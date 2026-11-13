import type { Idea, IdeaAppeal } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  StatusTag,
  TextField,
  useApiAction,
  useLanguage,
  type Tone,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

// The limits the API enforces on an appeal (ModerationAppealIn).
const BODY_MIN = 10;
const BODY_MAX = 1000;

const APPEAL_TONES: Record<IdeaAppeal['state'], Tone> = { open: 'pending', upheld: 'neutral', changed: 'verified' };

/**
 * D12 "one appeal": on the author's own idea that was not published, the moderator's decision may
 * be appealed once; a different moderator decides it. Once sent, the appeal's state, and when
 * decided its outcome and reason, show instead of the form.
 */
export function IdeaAppealSection({ idea, onChanged }: { idea: Idea; onChanged: () => void }) {
  if (idea.appeal) return <AppealOutcome appeal={idea.appeal} />;
  if (idea.state !== 'rejected') return null;
  return <AppealForm ideaId={idea.id} onChanged={onChanged} />;
}

function AppealOutcome({ appeal }: { appeal: IdeaAppeal }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <View style={styles.section}>
      <AppText step="label">{t('m.ideas.appealHeading')}</AppText>
      <View style={styles.tags}>
        <StatusTag tone={APPEAL_TONES[appeal.state]} label={t(`m.ideas.appealState_${appeal.state}`)} />
      </View>
      <AppText step="secondary" tone="secondary">
        {t(`m.ideas.appealMeaning_${appeal.state}`)}
      </AppText>
      <AppText step="caption" tone="muted">
        {t('m.ideas.appealSentOn', { date: formatDate(appeal.createdAt, language) })}
      </AppText>
      {appeal.reason ? <DetailRow label={t('m.ideas.appealReason')} value={appeal.reason} /> : null}
    </View>
  );
}

function AppealForm({ ideaId, onChanged }: { ideaId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const tooShort = body.trim().length < BODY_MIN;
  const send = useApiAction(async () => {
    await api().appealModeration({ itemKind: 'idea', itemId: ideaId, body: body.trim() });
    onChanged();
  });

  if (!open) {
    return (
      <Button label={t('m.ideas.appealOpen')} variant="quiet" icon="chatbox-ellipses-outline" onPress={() => setOpen(true)} />
    );
  }
  return (
    <View style={styles.section}>
      <AppText step="label">{t('m.ideas.appealHeading')}</AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.ideas.appealIntro')}
      </AppText>
      <TextField
        label={t('m.ideas.appealLabel')}
        hint={t('m.ideas.appealHint', { min: BODY_MIN })}
        value={body}
        multiline
        textAlignVertical="top"
        maxLength={BODY_MAX}
        onChangeText={setBody}
        error={showErrors && tooShort ? t('m.ideas.appealTooShort', { min: BODY_MIN }) : null}
      />
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'ideas')}</Notice> : null}
      <Button
        label={t('m.ideas.appealSend')}
        icon="send-outline"
        busy={send.busy}
        onPress={() => {
          setShowErrors(true);
          if (!tooShort) void send.run();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
