import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';
import { AppText, Button, Notice, QrCode, useRotatingCode } from '@my-people/mobile-ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** C02: opaque codes are shown alone, refreshed before expiry and never stored on device. */
export default function CardCodeScreen() {
  const { t } = useTranslation();
  const code = useRotatingCode(() => api().getMyCardCode(), true);
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    const tick = () => setSeconds(code.data ? Math.max(0, Math.ceil((new Date(code.data.expiresAt).getTime() - Date.now()) / 1000)) : 60);
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [code.data]);
  return <SafeAreaView style={styles.page}><Button label={t('m.card.closeCode')} variant="secondary" onPress={() => router.back()} /><View style={styles.content}><AppText step="section" tone="inverse" accessibilityRole="header">{t('m.card.showCode')}</AppText><AppText step="body" tone="inverse" style={styles.center}>{t('m.card.antiScreenshot')}</AppText><View style={styles.qr}>{code.data ? <QrCode value={code.data.code} size={260} label={t('m.card.showCode')} /> : <AppText step="body">{t('m.events.passRefreshing')}</AppText>}</View><View accessibilityRole="timer" accessibilityLabel={t('m.card.codeSeconds', { seconds })} style={styles.timer}><AppText step="page" tone="inverse">{seconds}</AppText></View><AppText step="secondary" tone="inverse" style={styles.center}>{t('m.card.codeHint')}</AppText>{code.error ? <Notice tone="error">{errorMessage(t, code.error)}</Notice> : null}</View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.primary, padding: spacing.gutter, gap: spacing[4] }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] }, qr: { backgroundColor: colors.card, padding: spacing[3], borderRadius: radius.card }, timer: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.onPrimary, alignItems: 'center', justifyContent: 'center' }, center: { textAlign: 'center' } });
