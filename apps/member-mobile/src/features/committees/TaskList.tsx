import type { CommitteeItem } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { dateOnly } from './labels';
import { Empty } from './SpaceItems';

/** Tasks and volunteer opportunities with due dates (FR-COM-006): the member's own tasks first. */
export function TaskList({ committeeId, items, onChanged }: { committeeId: string; items: CommitteeItem[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const work = items
    .filter((item) => item.itemType === 'task' || item.itemType === 'volunteer')
    .sort((a, b) => Number(b.assignedToMe) - Number(a.assignedToMe) || (a.dueOn ?? '').localeCompare(b.dueOn ?? ''));
  if (work.length === 0) return <Empty text={t('m.committees.noTasks')} />;
  return (
    <View style={styles.list}>
      {work.map((item) =>
        item.itemType === 'task' ? (
          <TaskCard key={item.id} committeeId={committeeId} item={item} onChanged={onChanged} />
        ) : (
          <VolunteerCard key={item.id} committeeId={committeeId} item={item} onChanged={onChanged} />
        ),
      )}
    </View>
  );
}

function TaskCard({ committeeId, item, onChanged }: { committeeId: string; item: CommitteeItem; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const done = useApiAction(async () => {
    await api().completeCommitteeTask(committeeId, item.id);
    onChanged();
  });
  return (
    <SurfaceCard style={styles.card} accent={item.assignedToMe && !item.doneAt}>
      <AppText step="caption" tone="primary">
        {item.assignedToMe ? t('m.committees.assignedToYou') : t('m.committees.task')}
      </AppText>
      <AppText step="card">{item.title}</AppText>
      <AppText step="body">{item.body}</AppText>
      {item.assigneeName && !item.assignedToMe ? (
        <AppText step="secondary" tone="secondary">
          {t('m.committees.assignedTo', { name: item.assigneeName })}
        </AppText>
      ) : null}
      <View style={styles.tags}>
        {item.dueOn ? (
          <StatusTag tone="neutral" label={t('m.committees.due', { date: formatDate(dateOnly(item.dueOn), language) })} />
        ) : null}
        {item.doneAt ? <StatusTag tone="verified" label={t('m.committees.done')} /> : null}
        {item.overdue ? <StatusTag tone="error" label={t('m.committees.overdue')} /> : null}
      </View>
      {done.error ? <Notice tone="error">{errorMessage(t, done.error, 'committees')}</Notice> : null}
      {item.assignedToMe && !item.doneAt ? (
        <Button
          variant="secondary"
          icon="checkmark-circle-outline"
          label={t('m.committees.markDone')}
          busy={done.busy}
          onPress={() => void done.run()}
        />
      ) : null}
    </SurfaceCard>
  );
}

function VolunteerCard({ committeeId, item, onChanged }: { committeeId: string; item: CommitteeItem; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const places = item.places ?? 0;
  const left = Math.max(0, places - item.signups);
  const change = useApiAction(async (signedUp: boolean) => {
    await api().setCommitteeSignup(committeeId, item.id, signedUp);
    onChanged();
  });
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="caption" tone="primary">
        {t('m.committees.volunteer')}
      </AppText>
      <AppText step="card">{item.title}</AppText>
      <AppText step="body">{item.body}</AppText>
      <View style={styles.tags}>
        {item.dueOn ? (
          <StatusTag tone="neutral" label={t('m.committees.due', { date: formatDate(dateOnly(item.dueOn), language) })} />
        ) : null}
        <StatusTag tone={left > 0 ? 'neutral' : 'pending'} label={t('m.committees.placesLeft', { left, places })} />
        {item.signedUp ? <StatusTag tone="verified" label={t('m.committees.signedUp')} /> : null}
      </View>
      {change.error ? <Notice tone="error">{errorMessage(t, change.error, 'committees')}</Notice> : null}
      {item.signedUp ? (
        <Button
          variant="secondary"
          label={t('m.committees.withdrawSignup')}
          busy={change.busy}
          onPress={() => void change.run(false)}
        />
      ) : left > 0 ? (
        <Button
          icon="hand-left-outline"
          label={t('m.committees.signUp')}
          busy={change.busy}
          onPress={() => void change.run(true)}
        />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
