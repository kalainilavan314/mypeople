import * as Brightness from 'expo-brightness';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, SafeAreaView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, QrCode, useRotatingCode } from '@my-people/mobile-ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const RADIUS = 37;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** C02: a live signed code, never saved or shared; restore device brightness on dismissal. */
export default function CardCodeScreen() {
  const { t } = useTranslation();
  const code = useRotatingCode(() => api().getMyCardCode(), true);
  const [seconds, setSeconds] = useState(60);
  const [brightnessManual, setBrightnessManual] = useState(false);

  useEffect(() => {
    const tick = () => setSeconds(code.data ? Math.max(0, Math.ceil((Date.parse(code.data.expiresAt) - Date.now()) / 1000)) : 60);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [code.data]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    let foreground = AppState.currentState === 'active';
    let previous: number | null = null;
    let usedSystem = false;
    let changed = false;
    let transition = Promise.resolve();
    const restore = async () => {
      if (!changed || previous === null) return;
      changed = false;
      if (Platform.OS === 'android' && usedSystem) await Brightness.restoreSystemBrightnessAsync();
      else await Brightness.setBrightnessAsync(previous);
    };
    const brighten = async () => {
      if (changed) return;
      if (!(await Brightness.isAvailableAsync())) {
        if (mounted) setBrightnessManual(true);
        return;
      }
      previous = await Brightness.getBrightnessAsync();
      if (Platform.OS === 'android') usedSystem = await Brightness.isUsingSystemBrightnessAsync();
      if (!mounted || !foreground) return;
      await Brightness.setBrightnessAsync(1);
      changed = true;
    };
    const sync = () => {
      transition = transition.then(async () => {
        if (mounted && foreground) await brighten();
        if (!mounted || !foreground) await restore();
      }).catch(() => { if (mounted) setBrightnessManual(true); });
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      sync();
    });
    return () => {
      mounted = false;
      subscription.remove();
      sync();
    };
  }, []);

  const activeCode = code.data && seconds > 0 && Date.parse(code.data.expiresAt) > Date.now() ? code.data.code : null;
  const remaining = Math.min(1, seconds / 60);

  return (
    <SafeAreaView style={styles.page}>
      <Button label={t('m.card.closeCode')} variant="secondary" onPress={() => router.back()} />
      <View style={styles.content}>
        <AppText step="section" tone="inverse" accessibilityRole="header">{t('m.card.showCode')}</AppText>
        <AppText step="body" tone="inverse" style={styles.center}>{t('m.card.antiScreenshot')}</AppText>
        <View style={styles.qr}>
          {activeCode ? <QrCode value={activeCode} size={260} label={t('m.card.showCode')} />
            : <AppText step="body">{t('m.events.passRefreshing')}</AppText>}
        </View>
        <View accessible accessibilityRole="timer" accessibilityLabel={t('m.card.codeSeconds', { seconds })} style={styles.timer}>
          <Svg width={88} height={88} style={styles.ring}>
            <Circle cx={44} cy={44} r={RADIUS} stroke={colors.inputBorder} strokeWidth={5} fill="none" />
            <Circle cx={44} cy={44} r={RADIUS} stroke={colors.onPrimary} strokeWidth={5} fill="none"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - remaining)}
              rotation={-90} origin="44, 44" />
          </Svg>
          <AppText step="page" tone="inverse">{seconds}</AppText>
        </View>
        <AppText step="secondary" tone="inverse" style={styles.center}>{t('m.card.codeHint')}</AppText>
        {brightnessManual ? <Notice tone="info">{t('m.card.brightnessManual')}</Notice> : null}
        {code.error ? <Notice tone="error">{errorMessage(t, code.error)}</Notice> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.primary, padding: spacing.gutter, gap: spacing[4] },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  qr: { backgroundColor: colors.card, padding: spacing[3], borderRadius: radius.card },
  timer: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  center: { textAlign: 'center' },
});
