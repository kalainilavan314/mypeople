import type { ReliefTask, SafetyHome } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  ChipRow,
  confirmAction,
  formatDate,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { OFFER_WEEKS, RELIEF_TASKS, weeksFromToday } from '@/features/safety/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Weeks = `${(typeof OFFER_WEEKS)[number]}`;

/**
 * FR-DIS-004: a Verified, Active member offers to help with relief work in their home area until a date.
 * Relief coordinators of that area see the name, the tasks and the date, never a phone number; they
 * arrange the work through a volunteering opportunity. The offer can be changed or withdrawn at any time.
 */
export default function ReliefOfferScreen() {
  const { t } = useTranslation();
  const home = useApiQuery(() => api().getSafetyHome());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="safety" query={home}>
        {(data) => <OfferForm data={data} onSaved={home.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function OfferForm({ data, onSaved }: { data: SafetyHome; onSaved: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [tasks, setTasks] = useState<ReliefTask[]>(data.reliefOffer?.tasks ?? []);
  const [weeks, setWeeks] = useState<Weeks>('2');
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = useApiAction(async () => {
    await api().saveReliefOffer({ tasks, availableUntil: weeksFromToday(Number(weeks)), consent });
    setSaved(true);
    onSaved();
  });
  const withdraw = useApiAction(async () => {
    await api().withdrawReliefOffer();
    onSaved();
    router.back();
  });

  if (data.reliefOfferLock) {
    return (
      <Notice tone="info" title={t('m.safety.reliefLockedTitle')}>
        {t(`m.safety.reliefLock_${data.reliefOfferLock}`)}
      </Notice>
    );
  }

  const toggle = (task: ReliefTask, on: boolean) =>
    setTasks((current) => (on ? [...current, task] : current.filter((item) => item !== task)));
  const submit = () => {
    if (tasks.length === 0 || !consent) {
      setShowErrors(true);
      return;
    }
    setSaved(false);
    void save.run();
  };

  return (
    <View style={styles.body}>
      <AppText step="body" tone="secondary">
        {t('m.safety.reliefFormIntro')}
      </AppText>
      {data.reliefOffer ? (
        <Notice tone="info">
          {t('m.safety.reliefOffered', { date: formatDate(data.reliefOffer.availableUntil, language) })}
        </Notice>
      ) : null}
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.safety.tasksHeading')}
        </AppText>
        {RELIEF_TASKS.map((task) => (
          <Checkbox
            key={task}
            label={t(`m.safety.task_${task}`)}
            checked={tasks.includes(task)}
            onChange={(on) => toggle(task, on)}
          />
        ))}
        {showErrors && tasks.length === 0 ? (
          <AppText step="secondary" tone="error">
            {t('m.safety.tasksError')}
          </AppText>
        ) : null}
      </SurfaceCard>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.safety.howLong')}
        </AppText>
        <ChipRow
          label={t('m.safety.howLong')}
          selected={weeks}
          onSelect={setWeeks}
          options={OFFER_WEEKS.map((n) => ({ key: `${n}` as Weeks, label: t('m.safety.forWeeks', { count: n }) }))}
        />
        <AppText step="secondary" tone="muted">
          {t('m.safety.availableUntil', { date: formatDate(weeksFromToday(Number(weeks)), language) })}
        </AppText>
      </SurfaceCard>
      <SurfaceCard style={styles.card}>
        <Checkbox label={t('m.safety.reliefConsent')} checked={consent} onChange={setConsent} />
        {showErrors && !consent ? (
          <AppText step="secondary" tone="error">
            {t('m.safety.consentError')}
          </AppText>
        ) : null}
        {saved ? <Notice tone="success">{t('m.safety.reliefSaved')}</Notice> : null}
        {save.error ? <Notice tone="error">{errorMessage(t, save.error, 'safety')}</Notice> : null}
        <Button label={t('m.safety.reliefSave')} busy={save.busy} busyLabel={t('m.common.saving')} onPress={submit} />
        {data.reliefOffer ? (
          <>
            {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error, 'safety')}</Notice> : null}
            <Button
              label={t('m.safety.reliefWithdraw')}
              variant="danger"
              busy={withdraw.busy}
              onPress={() =>
                void confirmAction({
                  title: t('m.safety.reliefWithdraw'),
                  message: t('m.safety.reliefWithdrawConfirm'),
                  confirmLabel: t('m.safety.reliefWithdraw'),
                  cancelLabel: t('m.common.cancel'),
                  destructive: true,
                }).then((yes) => yes && void withdraw.run())
              }
            />
          </>
        ) : null}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  card: { gap: spacing[3] },
});
