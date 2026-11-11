import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  LanguageToggle,
  Notice,
  readOfflineCard,
  type OfflineCardPreview,
  useLanguage,
  useSession,
} from '@my-people/mobile-ui';

import { OfflineCard } from '@/features/membership/OfflineCard';
import { chooseLanguage } from '@/lib/i18n';

/**
 * A01: the name, the language, the goal and mission, and the way in, on one screen. The map takes the
 * height that is left, so nothing scrolls on a normal phone; only a very small screen or very large text
 * lets the page scroll, so nothing is ever cut off. When the app opens without a connection the stored
 * session cannot be checked, so the card saved at the last online visit is offered here (C03).
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { state, retry } = useSession();
  const [offlineCard, setOfflineCard] = useState<OfflineCardPreview | null>(null);
  const [missionOpen, setMissionOpen] = useState(false);
  useEffect(() => {
    if (state.status !== 'unreachable') return;
    let active = true;
    void readOfflineCard().then((saved) => { if (active) setOfflineCard(saved); });
    return () => { active = false; };
  }, [state.status]);
  const blocked = state.status === 'not_configured';
  // The map gets about 30% of the screen's height (26% in Tamil, whose lines run longer) so the rest
  // fits under it without scrolling; screens under 700 px tall use smaller gaps and a smaller map.
  const screenHeight = useWindowDimensions().height;
  const compact = screenHeight < 700;
  const share = compact ? (language === 'ta' ? 0.17 : 0.2) : language === 'ta' ? 0.26 : 0.3;
  const mapHeight = Math.max(100, Math.min(300, Math.round(screenHeight * share)));

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, compact && styles.compact]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            accessibilityIgnoresInvertColors
            accessible={false}
            importantForAccessibility="no"
          />
          <View style={styles.names}>
            <AppText step="section" weight={600} style={styles.tamilName} numberOfLines={1} accessibilityRole="header">
              என் மக்கள்
            </AppText>
            <AppText step="body" tone="muted" numberOfLines={1}>
              My People
            </AppText>
          </View>
          <LanguageToggle value={language} onChange={(next) => void chooseLanguage(next)} label={t('m.welcome.language')} />
        </View>

        <Image
          source={require('../../assets/images/welcome-map.png')}
          style={[styles.map, { height: mapHeight }]}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />

        <View style={styles.region}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <AppText step="secondary" tone="secondary">
            {t('m.welcome.region')}
          </AppText>
        </View>

        <View accessible accessibilityRole="header">
          <AppText step="display" style={styles.center}>
            {t('m.welcome.goal')}
          </AppText>
          <AppText step="display" style={styles.center}>
            {t('m.welcome.goalLine2')}
          </AppText>
        </View>

        <View style={[styles.mission, compact && styles.missionCompact]}>
          <AppText step="card" weight={400}>
            {t('m.welcome.missionTitle')}
          </AppText>
          <AppText step="secondary" tone="muted">
            {missionOpen ? t('m.welcome.missionFull') : t('m.welcome.missionBody')}
          </AppText>
          <Pressable
            onPress={() => setMissionOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={missionOpen ? t('m.welcome.missionLess') : t('m.welcome.missionMore')}
            accessibilityState={{ expanded: missionOpen }}
            hitSlop={{ top: 10, bottom: 10 }}
            style={styles.link}>
            <AppText step="body" tone="link">
              {missionOpen ? t('m.welcome.missionLess') : t('m.welcome.missionMore')}
            </AppText>
          </Pressable>
        </View>

        {state.status === 'signed_out' && state.expired ? <Notice tone="warning">{t('m.welcome.expired')}</Notice> : null}
        {blocked ? <Notice tone="error">{t('m.welcome.notConfigured')}</Notice> : null}
        {state.status === 'unreachable' ? (
          <View style={styles.gap}>
            <Notice tone="error">{t('m.welcome.unreachable')}</Notice>
            {offlineCard ? <OfflineCard preview={offlineCard} /> : null}
            <Button label={t('m.common.retry')} variant="secondary" icon="refresh" onPress={retry} />
          </View>
        ) : null}

        <Button label={t('m.welcome.join')} icon="arrow-forward" iconAfter disabled={blocked} onPress={() => router.push('/register')} />
        <View style={styles.signInRow}>
          <AppText step="body" tone="muted">
            {t('m.welcome.haveAccount')}
          </AppText>
          <Pressable
            onPress={() => router.push('/sign-in')}
            disabled={blocked}
            accessibilityRole="link"
            accessibilityLabel={t('m.welcome.signInLink')}
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}>
            <AppText step="body" weight={500} tone="primary">
              {t('m.welcome.signInLink')}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  // flexGrow lets the map take the height that is left; a small phone scrolls instead of cutting off.
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[3] },
  compact: { gap: spacing[2] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  logo: { width: 44, height: 44, borderRadius: 22 },
  names: { flex: 1, minWidth: 0 },
  tamilName: { fontSize: 18, lineHeight: 26 },
  map: { width: '100%', alignSelf: 'center' },
  region: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  center: { textAlign: 'center' },
  mission: {
    gap: spacing[1],
    padding: spacing[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  missionCompact: { paddingVertical: spacing[3] },
  link: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center' },
  gap: { gap: spacing[3] },
  signInRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing[1], minHeight: 32 },
});
