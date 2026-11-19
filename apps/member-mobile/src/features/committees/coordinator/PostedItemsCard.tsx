import type { CommitteeItem, CommitteeRole } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { committeeErrorMessage } from './committeeErrors';

const REASON_MIN = 3;

/**
 * S18: what is published in the committee. A coordinator takes anything down with a reason, a
 * secretary only discussion threads; nothing is deleted. Volunteer sign-ups are listed by name.
 */
export function PostedItemsCard({
  committeeId,
  role,
  items,
  onChanged,
}: {
  committeeId: string;
  role: CommitteeRole;
  items: CommitteeItem[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.committees.recent')}
      </AppText>
      {items.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('s.common.empty')}
        </AppText>
      ) : (
        items.map((item) => (
          <Posted
            key={item.id}
            committeeId={committeeId}
            item={item}
            canHide={role === 'coordinator' || item.itemType === 'thread'}
            onChanged={onChanged}
          />
        ))
      )}
    </SurfaceCard>
  );
}

function Posted({
  committeeId,
  item,
  canHide,
  onChanged,
}: {
  committeeId: string;
  item: CommitteeItem;
  canHide: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);
  const [names, setNames] = useState<string[] | null>(null);
  const hide = useApiAction(async () => {
    await api().hideCommitteeItem(committeeId, item.id, reason.trim());
    onChanged();
  });
  const loadNames = useApiAction(async () => {
    setNames((await api().listCommitteeSignups(committeeId, item.id)).names);
  });
  const failed = hide.error ?? loadNames.error;

  return (
    <View style={styles.entry}>
      <View style={styles.tags}>
        <StatusTag tone="neutral" label={t(`s.committees.type_${item.itemType}`)} />
        {item.overdue ? <StatusTag tone="error" label={t('m.committees.overdue')} /> : null}
        {item.doneAt ? <StatusTag tone="verified" label={t('m.committees.done')} /> : null}
      </View>
      <AppText step="card">{item.title}</AppText>
      <AppText step="caption" tone="muted">
        {t('m.committees.byOn', { name: item.authorName, date: formatDate(item.createdAt, language) })}
      </AppText>
      {item.assigneeName ? (
        <AppText step="secondary" tone="secondary">
          {t('m.committees.assignedTo', { name: item.assigneeName })}
        </AppText>
      ) : null}
      {item.itemType === 'volunteer' ? (
        <>
          <AppText step="secondary" tone="secondary">
            {t('s.committees.signupCount', { count: item.signups, places: item.places ?? 0 })}
          </AppText>
          {names ? (
            <AppText step="secondary">{names.length > 0 ? names.join(', ') : t('s.common.empty')}</AppText>
          ) : (
            <Button
              variant="quiet"
              label={t('s.committees.showSignups')}
              busy={loadNames.busy}
              onPress={() => void loadNames.run()}
            />
          )}
        </>
      ) : null}
      {failed ? <Notice tone="error">{committeeErrorMessage(t, failed)}</Notice> : null}
      {canHide && !hiding ? (
        <Button variant="quiet" label={t('s.committees.hide')} onPress={() => setHiding(true)} />
      ) : null}
      {hiding ? (
        <>
          <TextField
            label={t('s.committees.hideReason')}
            hint={t('s.common.reasonHint')}
            value={reason}
            maxLength={500}
            onChangeText={setReason}
            error={showError && reason.trim().length < REASON_MIN ? t('s.committees.reasonRequired') : null}
          />
          <Button
            variant="danger"
            label={t('s.committees.hide')}
            busy={hide.busy}
            onPress={() => {
              if (reason.trim().length < REASON_MIN) {
                setShowError(true);
                return;
              }
              void hide.run();
            }}
          />
          <Button variant="quiet" label={t('s.common.cancel')} onPress={() => setHiding(false)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  entry: { gap: spacing[2], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.divider },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
