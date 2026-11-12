import { ApiError, type IssueReportingOptions } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  IconTile,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLocalized,
  useMember,
} from '@my-people/mobile-ui';

import { resetDraft, updateDraft, useIssueDraft, type IssueDraft } from '@/features/issues/draft';
import { photoUri, readPhoto } from '@/features/issues/draftPhotos';
import { draftProblems } from '@/features/issues/draftProblems';
import { DraftPhotoError, issueErrorMessage } from '@/features/issues/issueErrors';
import { IssuesQueryView } from '@/features/issues/IssuesQueryView';
import { CATEGORY_ICONS, CATEGORY_TINTS } from '@/features/issues/labels';
import { PhotoThumb } from '@/features/issues/PhotoThumb';
import { ReportingLocked } from '@/features/issues/ReportingLocked';
import { VisibilityChoice } from '@/features/issues/VisibilityChoice';
import { api } from '@/lib/api';
import { noAnswer } from '@/lib/errors';

/** "Edit" returns to the form underneath, or opens it when this screen was reached directly. */
function editReport() {
  if (router.canGoBack()) router.back();
  else router.replace('/issues/report');
}

/**
 * H08 Review report: every detail, and who may see it, before sending. Photos not yet on the
 * server go first and their ids are kept in the draft, so a retry never sends one twice; the
 * report itself carries the draft's reference, so a retry never makes a second case (FR-RPT-013).
 * A failed send keeps the draft on the device.
 */
export default function ReviewIssueScreen() {
  const options = useApiQuery(() => api().getIssueReportingOptions());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <IssuesQueryView query={options}>
        {(data) => (data.allowed ? <ReviewBody options={data} /> : <ReportingLocked reason={data.reason} />)}
      </IssuesQueryView>
    </Screen>
  );
}

function ReviewBody({ options }: { options: IssueReportingOptions }) {
  const { t } = useTranslation();
  const member = useMember();
  const { draft } = useIssueDraft(member.id);
  // What was sent stays on screen while the receipt opens; the stored draft is already cleared.
  const [sent, setSent] = useState<IssueDraft | null>(null);
  const [photoProgress, setPhotoProgress] = useState<{ number: number; total: number } | null>(null);

  const send = useApiAction(async (report: IssueDraft) => {
    const photoIds: string[] = [];
    try {
      for (const [index, photo] of report.photos.entries()) {
        if (photo.photoId) {
          photoIds.push(photo.photoId);
          continue;
        }
        setPhotoProgress({ number: index + 1, total: report.photos.length });
        const saved = await api().uploadIssuePhoto(await readPhoto(photo.key), 'image/jpeg');
        updateDraft((current) => ({
          ...current,
          photos: current.photos.map((kept) => (kept.key === photo.key ? { ...kept, photoId: saved.id } : kept)),
        }));
        photoIds.push(saved.id);
      }
    } finally {
      setPhotoProgress(null);
    }

    let issueId: string;
    try {
      const issue = await api().submitIssueReport({
        clientReference: report.clientReference,
        category: report.category ?? 'other',
        title: report.title.trim(),
        description: report.description.trim(),
        locationKind: report.locationKind,
        locationText: report.locationKind === 'my_gn' ? null : report.locationText.trim(),
        visibility: report.visibility,
        photoIds,
      });
      issueId = issue.id;
    } catch (error) {
      // Photos the server held for a day expire; upload them again on the next try.
      if (error instanceof ApiError && error.problems.includes('photo_not_found')) {
        updateDraft((current) => ({ ...current, photos: current.photos.map((photo) => ({ ...photo, photoId: null })) }));
      }
      throw error;
    }

    setSent(report);
    resetDraft();
    // The form under this screen closes too, so Back from the receipt leads where the member began.
    router.dismissTo('/issues/report');
    router.replace({ pathname: '/issues/[id]', params: { id: issueId, receipt: '1' } });
  });

  const shown = sent ?? draft;
  if (!shown) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={t('m.common.loading')}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!sent && draftProblems(shown, options.descriptionMin).length > 0) {
    return (
      <Notice tone="warning" title={t('m.issues.notReadyTitle')}>
        <AppText step="secondary" tone="warning">
          {t('m.issues.notReadyBody')}
        </AppText>
        <Button label={t('m.issues.editReport')} variant="secondary" icon="create-outline" onPress={editReport} />
      </Notice>
    );
  }

  const busyLabel = photoProgress ? t('m.issues.sendingPhoto', photoProgress) : t('m.issues.sendingReport');
  // A photo this device could not read is not a connection problem.
  const offline = send.error !== null && !(send.error instanceof DraftPhotoError) && noAnswer(send.error);

  return (
    <View style={styles.body}>
      <AppText step="body" tone="secondary">
        {t('m.issues.reviewIntro')}
      </AppText>
      <ReportSummary report={shown} options={options} />

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.issues.visibility')}
        </AppText>
        <VisibilityChoice
          value={shown.visibility}
          onChange={(visibility) => {
            if (!send.busy && !sent) updateDraft((current) => ({ ...current, visibility }));
          }}
        />
      </SurfaceCard>

      {send.error ? (
        offline ? (
          <Notice tone="warning">{t('m.issues.notSentOffline')}</Notice>
        ) : (
          <Notice tone="error">{`${issueErrorMessage(t, send.error)}\n${t('m.issues.notSentKept')}`}</Notice>
        )
      ) : null}

      <Button
        label={t('m.issues.sendReport')}
        icon="send-outline"
        busy={send.busy || sent !== null}
        busyLabel={busyLabel}
        onPress={() => {
          if (draft) void send.run(draft);
        }}
      />
      <Button label={t('m.issues.editReport')} variant="secondary" icon="create-outline" disabled={send.busy} onPress={editReport} />
    </View>
  );
}

/** Everything the member wrote, as the team will receive it. */
function ReportSummary({ report, options }: { report: IssueDraft; options: IssueReportingOptions }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const category = report.category ?? 'other';
  const gnName = options.gnNameEn ? localized(options.gnNameEn, options.gnNameTa ?? '') : '';
  const place =
    report.locationKind === 'my_gn' ? t('m.issues.placeMyGnBody', { name: gnName }) : report.locationText.trim();

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.categoryRow}>
        <IconTile icon={CATEGORY_ICONS[category]} tint={CATEGORY_TINTS[category]} size={40} />
        <View style={styles.flex}>
          <AppText step="caption" tone="muted">
            {t('m.issues.category')}
          </AppText>
          <AppText step="card">{t(`m.issues.category_${category}`)}</AppText>
        </View>
      </View>
      <Detail label={t('m.issues.titleLabel')} value={report.title.trim()} />
      <Detail label={t('m.issues.place')} value={place} />
      <Detail label={t('m.issues.descriptionLabel')} value={report.description.trim()} />
      <View style={styles.detail}>
        <AppText step="label">{t('m.issues.photoCount', { count: report.photos.length })}</AppText>
        {report.photos.length > 0 ? (
          <View style={styles.thumbs}>
            {report.photos.map((photo, index) => (
              <PhotoThumb key={photo.key} uri={photoUri(photo.key)} number={index + 1} uploaded={photo.photoId !== null} />
            ))}
          </View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText step="label">{label}</AppText>
      <AppText step="body" tone="secondary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
  loading: { paddingVertical: spacing[8], alignItems: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  detail: { gap: 2 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], paddingTop: spacing[1] },
});
