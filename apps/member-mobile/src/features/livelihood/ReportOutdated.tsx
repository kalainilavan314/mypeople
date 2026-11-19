import type { GuideReport, GuideReportReason } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { REPORT_NOTE_MAX, REPORT_REASONS } from './labels';

/**
 * FR-LIV-006: report an entry that looks outdated. The editors get it with the entry's link; the
 * reporter's name is never shown to them. One open report per person and entry.
 */
export function ReportOutdated({
  entryId,
  openReport,
  onReported,
}: {
  entryId: string;
  openReport: GuideReport | null;
  onReported: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<GuideReportReason | null>(null);
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);
  const send = useApiAction(async () => {
    if (!reason) return;
    await api().reportGuideEntry(entryId, reason, note.trim() || undefined);
    setOpen(false);
    setNote('');
    setReason(null);
    onReported();
  });

  if (openReport) {
    return (
      <Notice tone="success" title={t('m.livelihood.reportedTitle')}>
        {t('m.livelihood.reportedBody', { date: formatDate(openReport.createdAt, language) })}
      </Notice>
    );
  }

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.livelihood.reportTitle')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.livelihood.reportIntro')}
      </AppText>
      {open ? (
        <>
          <SelectField
            label={t('m.livelihood.reportReason')}
            placeholder={t('m.livelihood.chooseReason')}
            value={reason}
            options={REPORT_REASONS.map((key) => ({ value: key, label: t(`m.livelihood.reason_${key}`) }))}
            onChange={(value) => setReason(REPORT_REASONS.find((key) => key === value) ?? null)}
            error={showError && !reason ? t('m.livelihood.reasonRequired') : null}
          />
          <TextField
            label={t('m.livelihood.reportNote')}
            hint={t('m.livelihood.reportNoteHint')}
            optional
            value={note}
            multiline
            textAlignVertical="top"
            maxLength={REPORT_NOTE_MAX}
            onChangeText={setNote}
          />
          {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'livelihood')}</Notice> : null}
          <Button
            label={t('m.livelihood.sendReport')}
            icon="send-outline"
            busy={send.busy}
            onPress={() => {
              if (!reason) {
                setShowError(true);
                return;
              }
              void send.run();
            }}
          />
          <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setOpen(false)} />
        </>
      ) : (
        <Button label={t('m.livelihood.reportOpen')} icon="alert-circle-outline" variant="secondary" onPress={() => setOpen(true)} />
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing[3] } });
