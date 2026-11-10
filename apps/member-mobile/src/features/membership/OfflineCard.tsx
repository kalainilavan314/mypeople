import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import { AppText, Notice, SurfaceCard, type OfflineCardPreview } from '@my-people/mobile-ui';

/** A saved visual copy without a QR. A coordinator must check current status online. */
export function OfflineCard({ preview }: { preview: OfflineCardPreview }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.max(0, Math.floor((now - Date.parse(preview.syncedAt)) / 60_000));

  return (
    <View style={styles.content}>
      <Notice tone="warning" title={t('m.card.offlineTitle')}>
        {t('m.card.offlineLimit')}
      </Notice>
      <SurfaceCard>
        <AppText step="label" tone="secondary">{t('m.card.offlineSynced', { minutes })}</AppText>
        <AppText step="section" accessibilityRole="header">{preview.displayName}</AppText>
        <AppText step="body" mono>{preview.memberCode}</AppText>
        {preview.districtName ? <AppText step="secondary">{preview.districtName}</AppText> : null}
        {preview.gnName ? <AppText step="secondary">{preview.gnName}</AppText> : null}
      </SurfaceCard>
      <AppText step="caption" tone="muted">{t('m.card.noIdNumbers')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing[3] } });
