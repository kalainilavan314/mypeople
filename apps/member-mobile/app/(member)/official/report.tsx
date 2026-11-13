import type { MisinfoReport } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, Screen, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { FieldError } from '@/components/FieldError';
import { ReceiptCard } from '@/components/ReceiptCard';
import { discardImage, pickImage, type PickedImage } from '@/features/identity/pickImage';
import { PhotoThumb } from '@/features/issues/PhotoThumb';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

// The API's limits (MisinfoReportIn).
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;
const LINK = /^https?:\/\/\S+$/;

/**
 * M48 Report a statement: a link or a screenshot (one is required) and what seems wrong. A
 * fact-checker, a person, reads every report and gives a reason; nothing is scored automatically.
 */
export default function ReportStatementScreen() {
  const { t } = useTranslation();
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<PickedImage | null>(null);
  const [denied, setDenied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [receipt, setReceipt] = useState<MisinfoReport | null>(null);

  const choose = useApiAction(async (source: 'camera' | 'library') => {
    setDenied(false);
    const picked = await pickImage(source);
    if ('denied' in picked) {
      setDenied(true);
      return;
    }
    if ('cancelled' in picked) return;
    if (screenshot) discardImage(screenshot);
    setScreenshot(picked.image);
  });
  const send = useApiAction(async () => {
    const screenshotId = screenshot ? (await api().uploadMisinfoScreenshot(screenshot.body, screenshot.contentType)).id : undefined;
    const made = await api().reportMisinformation({
      link: link.trim() || undefined,
      description: description.trim(),
      screenshotId,
    });
    if (screenshot) discardImage(screenshot);
    setScreenshot(null);
    setReceipt(made);
  });

  if (receipt) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <ReceiptCard
          title={t('m.official.receiptTitle')}
          referenceLabel={t('m.official.reference')}
          reference={receipt.reportRef}
          body={t('m.official.receiptBody')}>
          <Button
            label={t('m.official.myReports')}
            icon="list-outline"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/official'))}
          />
        </ReceiptCard>
      </Screen>
    );
  }

  const problems = {
    source: link.trim() === '' && !screenshot,
    link: link.trim() !== '' && !LINK.test(link.trim()),
    description: description.trim().length < DESCRIPTION_MIN,
  };
  const submit = () => {
    if (problems.source || problems.link || problems.description) {
      setShowErrors(true);
      return;
    }
    void send.run();
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <AppText step="body" tone="secondary">
        {t('m.official.formIntro')}
      </AppText>
      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.official.link')}
          hint={t('m.official.linkHint')}
          optional
          value={link}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={1000}
          onChangeText={setLink}
          error={showErrors && problems.link ? t('m.official.linkError') : null}
        />
        <AppText step="label">{t('m.official.screenshot')}</AppText>
        {screenshot ? (
          <View style={styles.thumb}>
            <PhotoThumb
              uri={screenshot.previewUri}
              number={1}
              onRemove={() => {
                discardImage(screenshot);
                setScreenshot(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button label={t('m.official.chooseScreenshot')} variant="secondary" icon="images-outline" busy={choose.busy} onPress={() => void choose.run('library')} />
            <Button label={t('m.official.takePhoto')} variant="secondary" icon="camera-outline" disabled={choose.busy} onPress={() => void choose.run('camera')} />
          </View>
        )}
        {denied ? <Notice tone="warning">{t('m.official.photoDenied')}</Notice> : null}
        {choose.error ? <Notice tone="error">{errorMessage(t, choose.error, 'official')}</Notice> : null}
        {showErrors && problems.source ? <FieldError text={t('m.official.sourceRequired')} /> : null}
      </SurfaceCard>
      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.official.description')}
          hint={t('m.official.descriptionHint', { min: DESCRIPTION_MIN })}
          value={description}
          multiline
          textAlignVertical="top"
          maxLength={DESCRIPTION_MAX}
          onChangeText={setDescription}
          error={showErrors && problems.description ? t('m.official.atLeast', { min: DESCRIPTION_MIN }) : null}
        />
      </SurfaceCard>
      <AppText step="secondary" tone="secondary">
        {t('m.official.personChecks')}
      </AppText>
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'official')}</Notice> : null}
      <Button label={t('m.official.send')} icon="send-outline" busy={send.busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  thumb: { flexDirection: 'row' },
  actions: { gap: spacing[2] },
});
