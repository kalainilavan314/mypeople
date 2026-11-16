import Ionicons from '@expo/vector-icons/Ionicons';
import type { SupportAppealInput, SupportDecision } from '@my-people/api-client';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  SegmentedControl,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { FieldError } from '@/components/FieldError';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { LIMITS } from './labels';

type Kind = SupportAppealInput['kind'];

/**
 * M14 Complaint or appeal: one per decision. Someone other than the person who made the decision
 * looks at it within 15 working days (FR-AST-010).
 */
export function AppealForm({ caseId, decisions, onSent }: { caseId: string; decisions: SupportDecision[]; onSent: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [decisionId, setDecisionId] = useState<string | null>(decisions.length === 1 ? (decisions[0]?.id ?? null) : null);
  const [kind, setKind] = useState<Kind>('appeal');
  const [body, setBody] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const send = useApiAction(async () => {
    if (!decisionId) return;
    await api().appealSupportDecision(caseId, { decisionId, kind, body: body.trim() });
    setBody('');
    setShowErrors(false);
    onSent();
  });
  const short = body.trim().length < LIMITS.appealMin;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.support.appealTitle')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.support.appealExplain')}
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('m.support.whichDecision')}>
        <AppText step="label">{t('m.support.whichDecision')}</AppText>
        {decisions.map((decision) => {
          const label = `${t(`m.support.outcome_${decision.outcome}`)}, ${formatDate(decision.decidedAt, language)}`;
          const checked = decisionId === decision.id;
          return (
            <Pressable
              key={decision.id}
              onPress={() => setDecisionId(decision.id)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked }}
              aria-checked={checked}
              style={styles.radio}>
              <Ionicons
                accessible={false}
                name={checked ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color={checked ? colors.primary : colors.controlBorder}
              />
              <AppText step="body" style={styles.flex}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
        {showErrors && !decisionId ? <FieldError text={t('m.support.decisionError')} /> : null}
      </View>
      <SegmentedControl
        label={t('m.support.appealKind')}
        selected={kind}
        onSelect={setKind}
        options={[
          { key: 'appeal', label: t('m.support.kind_appeal') },
          { key: 'complaint', label: t('m.support.kind_complaint') },
        ]}
      />
      <AppText step="secondary" tone="muted">
        {t(`m.support.kindHint_${kind}`)}
      </AppText>
      <TextField
        label={t('m.support.appealLabel')}
        hint={t('m.support.atLeastHint', { min: LIMITS.appealMin })}
        value={body}
        multiline
        textAlignVertical="top"
        maxLength={LIMITS.appealMax}
        onChangeText={setBody}
        error={showErrors && short ? t('m.support.atLeast', { min: LIMITS.appealMin }) : null}
      />
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'support')}</Notice> : null}
      <Button
        label={t('m.support.sendAppeal')}
        icon="send-outline"
        busy={send.busy}
        onPress={() => {
          if (!decisionId || short) {
            setShowErrors(true);
            return;
          }
          void send.run();
        }}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  radio: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: control.height },
  flex: { flex: 1 },
});
