import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Notice,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { AreaFields } from '@/features/area/AreaFields';
import { useAreaName } from '@/features/area/useAreaName';
import { errorMessage, noAnswer } from '@/lib/errors';

import { chosenArea, proposalProblems, type ProposalField, type ProposalFields } from './draft';
import { LIMITS, PROPOSAL_CATEGORIES, rupees } from './labels';

type Props = {
  fields: ProposalFields;
  onChange: (change: (current: ProposalFields) => ProposalFields) => void;
  /** A new proposal names its area; a revision keeps the area it had. */
  withArea: boolean;
  /** "Draft kept on this phone" and "Discard draft" belong to a new proposal only. */
  kept: boolean;
  onDiscard?: () => void;
  sendLabel: string;
  send: (fields: ProposalFields) => Promise<void>;
};

/**
 * M16 the proposal form, then a review of every field before sending. Each field shows what is
 * missing beside it; the API checks everything again.
 */
export function ProposalForm({ fields, onChange, withArea, kept, onDiscard, sendLabel, send }: Props) {
  const { t } = useTranslation();
  const [reviewing, setReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const sending = useApiAction(send);
  const problems = proposalProblems(fields, withArea);
  const set = <K extends keyof ProposalFields>(key: K) => (value: ProposalFields[K]) =>
    onChange((current) => ({ ...current, [key]: value }));
  const error = (field: ProposalField, words: string) => (showErrors && problems.includes(field) ? words : null);

  if (reviewing) {
    const offline = sending.error !== null && noAnswer(sending.error);
    return (
      <View style={styles.form}>
        <AppText step="body" tone="secondary">
          {t('m.proposals.reviewIntro')}
        </AppText>
        <ProposalSummary fields={fields} withArea={withArea} />
        {sending.error ? (
          <Notice tone={offline ? 'warning' : 'error'}>
            {offline ? t('m.proposals.notSentOffline') : errorMessage(t, sending.error, 'proposals')}
          </Notice>
        ) : null}
        <Button label={sendLabel} icon="send-outline" busy={sending.busy} onPress={() => void sending.run(fields)} />
        <Button
          label={t('m.proposals.edit')}
          variant="secondary"
          icon="create-outline"
          disabled={sending.busy}
          onPress={() => setReviewing(false)}
        />
      </View>
    );
  }

  const review = () => {
    if (problems.length > 0) {
      setShowErrors(true);
      return;
    }
    sending.clearError();
    setReviewing(true);
  };

  return (
    <View style={styles.form}>
      <AppText step="body" tone="secondary">
        {t('m.proposals.formIntro')}
      </AppText>

      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.proposals.titleLabel')}
          hint={t('m.proposals.titleHint', { max: LIMITS.titleMax })}
          value={fields.title}
          maxLength={LIMITS.titleMax}
          onChangeText={set('title')}
          error={error('title', t('m.proposals.titleError', { min: LIMITS.titleMin }))}
        />
        <SelectField
          label={t('m.proposals.category')}
          placeholder={t('m.proposals.chooseCategory')}
          value={fields.category}
          options={PROPOSAL_CATEGORIES.map((key) => ({ value: key, label: t(`m.proposals.category_${key}`) }))}
          onChange={(value) => set('category')(PROPOSAL_CATEGORIES.find((key) => key === value) ?? null)}
          error={error('category', t('m.proposals.categoryError'))}
        />
      </SurfaceCard>

      {withArea ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.proposals.area')}
          </AppText>
          <AppText step="secondary" tone="muted">
            {t('m.proposals.areaHint')}
          </AppText>
          <AreaFields value={fields.area} onChange={set('area')} error={error('area', t('m.proposals.areaError'))} />
        </SurfaceCard>
      ) : null}

      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.proposals.problemLabel')}
          hint={t('m.proposals.problemHint', { min: LIMITS.problemMin })}
          value={fields.problem}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.problemMax}
          onChangeText={set('problem')}
          error={error('problem', t('m.proposals.atLeast', { min: LIMITS.problemMin }))}
        />
        <TextField
          label={t('m.proposals.solutionLabel')}
          hint={t('m.proposals.solutionHint', { min: LIMITS.solutionMin })}
          value={fields.solution}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.solutionMax}
          onChangeText={set('solution')}
          error={error('solution', t('m.proposals.atLeast', { min: LIMITS.solutionMin }))}
        />
        <TextField
          label={t('m.proposals.benefitLabel')}
          hint={t('m.proposals.benefitHint', { min: LIMITS.benefitMin })}
          value={fields.benefit}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.benefitMax}
          onChangeText={set('benefit')}
          error={error('benefit', t('m.proposals.atLeast', { min: LIMITS.benefitMin }))}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.proposals.costLabel')}
          hint={t('m.proposals.costHint')}
          optional
          value={fields.cost}
          keyboardType="number-pad"
          maxLength={LIMITS.costDigits}
          onChangeText={(value) => set('cost')(value.replace(/\D/g, ''))}
        />
        <TextField
          label={t('m.proposals.evidenceLabel')}
          hint={t('m.proposals.evidenceHint')}
          optional
          value={fields.evidence}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.evidenceMax}
          onChangeText={set('evidence')}
        />
      </SurfaceCard>

      {showErrors && problems.length > 0 ? <Notice tone="error">{t('m.proposals.fixErrors')}</Notice> : null}
      {kept ? (
        <AppText step="caption" tone="muted">
          {t('m.proposals.draftKept')}
        </AppText>
      ) : null}
      <Button label={t('m.proposals.review')} icon="arrow-forward" iconAfter onPress={review} />
      {onDiscard ? <Button label={t('m.proposals.discardDraft')} variant="quiet" onPress={onDiscard} /> : null}
    </View>
  );
}

/** Everything the member wrote, as the moderators will receive it. */
function ProposalSummary({ fields, withArea }: { fields: ProposalFields; withArea: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const area = chosenArea(fields.area);
  const areaName = useAreaName(withArea && area ? `${area.level}:${area.code}` : null);
  return (
    <SurfaceCard style={styles.card}>
      <DetailRow label={t('m.proposals.titleLabel')} value={fields.title.trim()} />
      <DetailRow label={t('m.proposals.category')} value={fields.category ? t(`m.proposals.category_${fields.category}`) : ''} />
      {areaName ? <DetailRow label={t('m.proposals.area')} value={areaName} /> : null}
      <DetailRow label={t('m.proposals.problemLabel')} value={fields.problem.trim()} />
      <DetailRow label={t('m.proposals.solutionLabel')} value={fields.solution.trim()} />
      <DetailRow label={t('m.proposals.benefitLabel')} value={fields.benefit.trim()} />
      <DetailRow label={t('m.proposals.costLabel')} value={fields.cost ? rupees(fields.cost, language) : t('m.proposals.notGiven')} />
      <DetailRow label={t('m.proposals.evidenceLabel')} value={fields.evidence.trim() || t('m.proposals.notGiven')} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  card: { gap: spacing[3] },
});
