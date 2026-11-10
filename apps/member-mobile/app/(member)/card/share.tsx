import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ElementRef } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';
import { AppText, Button, Notice, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** C04: public name and member code only; never export the live QR or private ID data. */
export default function ShareCardScreen() {
  const { t } = useTranslation();
  const card = useApiQuery(() => api().getMyCard());
  const preview = useRef<ElementRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const shareImage = async () => {
    if (!preview.current || busy) return;
    setFailed(false);
    setBusy(true);
    let uri: string | null = null;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Share sheet unavailable');
      uri = await captureRef(preview.current, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('m.card.shareTitle') });
    } catch {
      setFailed(true);
    } finally {
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']} title={t('m.card.shareTitle')} onRefresh={card.reload}>
      {card.error ? (
        <>
          <Notice tone="error">{errorMessage(t, card.error)}</Notice>
          <Button label={t('m.common.retry')} variant="secondary" onPress={card.reload} />
        </>
      ) : <QueryView query={card}>
        {(data) => data.available && data.publicCard ? (
          <SurfaceCard>
            <View ref={preview} collapsable={false} style={styles.preview}>
              <AppText step="label" tone="inverse">என் மக்கள் · My People</AppText>
              <AppText step="section" tone="inverse">{data.publicCard.displayName}</AppText>
              <AppText step="body" tone="inverse" mono>{data.publicCard.memberCode}</AppText>
              <AppText step="caption" tone="inverse">{t('m.card.shareImageDisclaimer')}</AppText>
            </View>
            <Notice tone="info">{t('m.card.shareWarning')}</Notice>
            {failed ? <Notice tone="error">{t('m.card.shareFailed')}</Notice> : null}
            <Button
              label={t('m.card.shareAction')}
              disabled={Platform.OS === 'web' || busy}
              onPress={() => {
                setFailed(false);
                void Share.share({ message: t('m.card.shareMessage', {
                  name: data.publicCard?.displayName,
                  memberCode: data.publicCard?.memberCode,
                }) }).catch(() => setFailed(true));
              }}
            />
            <Button label={t('m.card.shareImage')} variant="secondary" busy={busy} disabled={Platform.OS === 'web'} onPress={() => void shareImage()} />
            {Platform.OS === 'web' ? <AppText step="secondary" tone="muted">{t('m.card.shareMobileOnly')}</AppText> : null}
            <AppText step="secondary" tone="muted">{t('m.card.walletLater')}</AppText>
          </SurfaceCard>
        ) : <Notice tone="warning">{t('m.card.unavailableTitle')}</Notice>}
      </QueryView>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { backgroundColor: colors.primary, borderRadius: radius.card, padding: spacing[4], gap: spacing[2] },
});
