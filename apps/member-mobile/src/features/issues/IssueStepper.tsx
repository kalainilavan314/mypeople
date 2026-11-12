import Ionicons from '@expo/vector-icons/Ionicons';
import type { IssueStatus, IssueStep } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, useLanguage } from '@my-people/mobile-ui';

import { MEMBER_STAGES } from './labels';

type Props = {
  steps: IssueStep[];
  /** The stage the issue is at now, 1 to 4. */
  stage: number;
  status: IssueStatus;
};

/**
 * The four stages a member sees, Reported, Verified, Decision, Action and closure, with the date
 * each was reached and the current one highlighted. The same stepper serves H06 and H09 (OD-13).
 */
export function IssueStepper({ steps, stage, status }: Props) {
  const { t } = useTranslation();
  const language = useLanguage();
  const finished = status === 'resolved' || status === 'declined';

  return (
    <View accessibilityRole="list">
      {MEMBER_STAGES.map((number, index) => {
        const reachedAt = steps.find((step) => step.stage === number)?.reachedAt ?? null;
        const current = number === stage && !finished;
        // A declined issue stops at its decision; that stage is marked with a cross, not a tick.
        const stopped = number === stage && status === 'declined';
        const done = !stopped && (number < stage || (number === stage && finished));
        const name = t(`m.issues.stage_${number}`);
        const when = reachedAt ? t('m.issues.stageReached', { date: formatDate(reachedAt, language) }) : t('m.issues.stageNotYet');
        const state = current
          ? t('m.issues.stageCurrent')
          : stopped
            ? t('m.issues.status_declined')
            : done
              ? t('m.issues.stageDone')
              : null;
        const last = index === MEMBER_STAGES.length - 1;
        return (
          <View
            key={number}
            accessible
            accessibilityLabel={[t('m.issues.stageOf', { number, stage: name }), when, state].filter(Boolean).join('. ')}
            style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent, stopped && styles.dotStopped]}>
                {done || stopped ? (
                  <Ionicons name={stopped ? 'close' : 'checkmark'} size={16} color={colors.onPrimary} />
                ) : (
                  <AppText step="label" tone={current ? 'inverse' : 'muted'}>
                    {number}
                  </AppText>
                )}
              </View>
              {last ? null : <View style={[styles.line, done && styles.lineDone]} />}
            </View>
            <View style={styles.text}>
              <AppText step="card" tone={current ? 'primary' : done || stopped ? 'default' : 'muted'}>
                {name}
              </AppText>
              <AppText step="secondary" tone={reachedAt ? 'secondary' : 'muted'}>
                {when}
              </AppText>
              {current ? (
                <AppText step="caption" tone="primary">
                  {t('m.issues.stageCurrent')}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 28;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  rail: { alignItems: 'center', width: DOT },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.controlBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.successText, borderColor: colors.successText },
  dotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotStopped: { backgroundColor: colors.error, borderColor: colors.error },
  line: { width: 2, flex: 1, minHeight: spacing[4], backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.successText },
  text: { flex: 1, gap: 2, paddingBottom: spacing[4] },
});
