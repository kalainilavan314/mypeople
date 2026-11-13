import type { IssueLocationKind, IssueReportingOptions } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  confirmAction,
  Notice,
  Screen,
  SegmentedControl,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLocalized,
  useMember,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { resetDraft, updateDraft, useIssueDraft, type IssueDraft } from '@/features/issues/draft';
import { forgetPhoto, keepPhoto, photoUri } from '@/features/issues/draftPhotos';
import { draftProblems } from '@/features/issues/draftProblems';
import { issueErrorMessage } from '@/features/issues/issueErrors';
import { IssuesQueryView } from '@/features/issues/IssuesQueryView';
import { LIMITS } from '@/features/issues/labels';
import { NoAreaNotice } from '@/features/issues/NoAreaNotice';
import { PhotoThumb } from '@/features/issues/PhotoThumb';
import { ReportingLocked } from '@/features/issues/ReportingLocked';
import { pickImage } from '@/features/identity/pickImage';
import { api } from '@/lib/api';

/**
 * H07 Report a concern. Only Verified and Active members with a GN division on their profile see
 * the form (FR-RPT-017); without one, the no-area notice sends them to set it, because every case
 * starts with their GN collector (W03), whatever place the report describes. Every change is saved on the device at once (FR-RPT-010); "Review report"
 * checks the fields first and shows what is missing beside each one (FR-RPT-008).
 */
export default function ReportIssueScreen() {
  const options = useApiQuery(() => api().getIssueReportingOptions());
  useReloadOnFocus(options.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <IssuesQueryView query={options}>
        {(data) =>
          !data.allowed ? <ReportingLocked reason={data.reason} /> : !data.hasArea ? <NoAreaNotice /> : <ReportForm options={data} />
        }
      </IssuesQueryView>
    </Screen>
  );
}

function ReportForm({ options }: { options: IssueReportingOptions }) {
  const { t } = useTranslation();
  const member = useMember();
  const { draft, lostPhotos } = useIssueDraft(member.id);
  const [showErrors, setShowErrors] = useState(false);

  if (!draft) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={t('m.common.loading')}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const problems = draftProblems(draft, options.descriptionMin);
  const review = () => {
    if (problems.length > 0) {
      setShowErrors(true);
      return;
    }
    router.push('/issues/review');
  };

  return (
    <View style={styles.form}>
      <AppText step="body" tone="secondary">
        {t('m.issues.reportIntro')}
      </AppText>

      <SurfaceCard style={styles.card}>
        <AppText step="body" tone="secondary">
          {t('m.issues.category')}
        </AppText>
        <ChipRow
          label={t('m.issues.category')}
          selected={draft.category}
          onSelect={(category) => updateDraft((current) => ({ ...current, category }))}
          options={options.categories.map((category) => ({ key: category, label: t(`m.issues.category_${category}`) }))}
        />
        {showErrors && problems.includes('category') ? <FieldError text={t('m.issues.categoryError')} /> : null}

        <TextField
          label={t('m.issues.titleLabel')}
          hint={t('m.issues.titleHint')}
          placeholder={t('m.issues.titlePlaceholder')}
          value={draft.title}
          maxLength={LIMITS.titleMax}
          onChangeText={(title) => updateDraft((current) => ({ ...current, title }))}
          error={showErrors && problems.includes('title') ? t('m.issues.titleError') : null}
        />
      </SurfaceCard>

      <PlaceCard draft={draft} options={options} error={showErrors && problems.includes('place')} />

      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.issues.descriptionLabel')}
          hint={t('m.issues.descriptionHint', { min: options.descriptionMin })}
          value={draft.description}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.descriptionMax}
          onChangeText={(description) => updateDraft((current) => ({ ...current, description }))}
          error={
            showErrors && problems.includes('description') ? t('m.issues.descriptionError', { min: options.descriptionMin }) : null
          }
        />
        <DescriptionCounter length={draft.description.trim().length} min={options.descriptionMin} />
      </SurfaceCard>

      <PhotosCard draft={draft} maxPhotos={options.maxPhotos} lostPhotos={lostPhotos} />

      {showErrors && problems.length > 0 ? <Notice tone="error">{t('m.issues.fixErrors')}</Notice> : null}

      <AppText step="caption" tone="muted">
        {t('m.issues.draftKept')}
      </AppText>
      <Button label={t('m.issues.reviewReport')} icon="arrow-forward" iconAfter onPress={review} />
      <DiscardButton draft={draft} />
    </View>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <AppText step="secondary" tone="error" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {text}
    </AppText>
  );
}

/** The live count beside the description; it reads "enough" once the minimum is met. */
function DescriptionCounter({ length, min }: { length: number; min: number }) {
  const { t } = useTranslation();
  const enough = length >= min;
  return (
    <AppText step="secondary" tone={enough ? 'success' : 'muted'}>
      {enough ? t('m.issues.descriptionEnough', { count: length }) : t('m.issues.descriptionCount', { count: length, min })}
    </AppText>
  );
}

/** Where the problem is: the member's GN division, a landmark, or typed words. The phone's location is never asked for. */
function PlaceCard({ draft, options, error }: { draft: IssueDraft; options: IssueReportingOptions; error: boolean }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  // The form is shown only with a GN division on the profile (hasArea), so "my GN division" is always a choice.
  const gnName = options.gnNameEn ? localized(options.gnNameEn, options.gnNameTa ?? '') : null;
  const kinds: { key: IssueLocationKind; label: string }[] = [
    { key: 'my_gn', label: t('m.issues.placeMyGn') },
    { key: 'landmark', label: t('m.issues.placeLandmark') },
    { key: 'text', label: t('m.issues.placeText') },
  ];
  const landmark = draft.locationKind === 'landmark';

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="body" tone="secondary">
        {t('m.issues.place')}
      </AppText>
      <SegmentedControl
        label={t('m.issues.place')}
        options={kinds}
        selected={draft.locationKind}
        onSelect={(locationKind) => updateDraft((current) => ({ ...current, locationKind }))}
      />
      {draft.locationKind === 'my_gn' ? (
        <AppText step="body">{t('m.issues.placeMyGnBody', { name: gnName ?? '' })}</AppText>
      ) : (
        <TextField
          label={landmark ? t('m.issues.landmarkLabel') : t('m.issues.placeTextLabel')}
          placeholder={landmark ? t('m.issues.landmarkPlaceholder') : t('m.issues.placeTextPlaceholder')}
          value={draft.locationText}
          maxLength={LIMITS.placeMax}
          onChangeText={(locationText) => updateDraft((current) => ({ ...current, locationText }))}
          error={error ? t('m.issues.placeError') : null}
        />
      )}
      <AppText step="secondary" tone="muted">
        {t('m.issues.noGps')}
      </AppText>
    </SurfaceCard>
  );
}

/** Up to maxPhotos photos, each copied into the app's own storage until the report is sent. */
function PhotosCard({ draft, maxPhotos, lostPhotos }: { draft: IssueDraft; maxPhotos: number; lostPhotos: number }) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const add = useApiAction(async (source: 'camera' | 'library') => {
    setDenied(false);
    const picked = await pickImage(source);
    if ('denied' in picked) {
      setDenied(true);
      return;
    }
    if ('cancelled' in picked) return;
    const key = Crypto.randomUUID();
    await keepPhoto(picked.image, key);
    updateDraft((current) =>
      current.photos.length >= maxPhotos ? current : { ...current, photos: [...current.photos, { key, photoId: null }] },
    );
  });
  const remove = (key: string) => {
    forgetPhoto(key);
    updateDraft((current) => ({ ...current, photos: current.photos.filter((photo) => photo.key !== key) }));
  };
  const full = draft.photos.length >= maxPhotos;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="body" tone="secondary">
        {t('m.issues.photos')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.issues.photosHint', { max: maxPhotos })}
      </AppText>
      {lostPhotos > 0 ? <Notice tone="warning">{t('m.issues.photosLost')}</Notice> : null}
      {draft.photos.length > 0 ? (
        <View style={styles.thumbs}>
          {draft.photos.map((photo, index) => (
            <PhotoThumb
              key={photo.key}
              uri={photoUri(photo.key)}
              number={index + 1}
              uploaded={photo.photoId !== null}
              onRemove={() => remove(photo.key)}
            />
          ))}
        </View>
      ) : null}
      {full ? (
        <AppText step="secondary" tone="muted">
          {t('m.issues.photosFull')}
        </AppText>
      ) : (
        <View style={styles.photoActions}>
          <Button
            label={t('m.issues.takePhoto')}
            icon="camera-outline"
            variant="secondary"
            busy={add.busy}
            onPress={() => void add.run('camera')}
          />
          <Button
            label={t('m.issues.choosePhoto')}
            icon="images-outline"
            variant="secondary"
            disabled={add.busy}
            onPress={() => void add.run('library')}
          />
        </View>
      )}
      {denied ? <Notice tone="warning">{t('m.issues.cameraDenied')}</Notice> : null}
      {add.error ? <Notice tone="error">{issueErrorMessage(t, add.error)}</Notice> : null}
    </SurfaceCard>
  );
}

function DiscardButton({ draft }: { draft: IssueDraft }) {
  const { t } = useTranslation();
  const started = Boolean(
    draft.category || draft.title.trim() || draft.description.trim() || draft.locationText.trim() || draft.photos.length,
  );
  if (!started) return null;
  const discard = async () => {
    const confirmed = await confirmAction({
      title: t('m.issues.discardTitle'),
      message: t('m.issues.discardBody'),
      confirmLabel: t('m.issues.discardDraft'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) resetDraft();
  };
  return <Button label={t('m.issues.discardDraft')} variant="quiet" onPress={() => void discard()} />;
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  card: { gap: spacing[3] },
  loading: { paddingVertical: spacing[8], alignItems: 'center' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  photoActions: { gap: spacing[2] },
});
