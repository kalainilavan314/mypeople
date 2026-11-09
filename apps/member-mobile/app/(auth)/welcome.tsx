import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import { AppText, Button, Notice, Screen, useLanguage, useSession } from '@my-people/mobile-ui';

import { OfflineCard } from '@/features/membership/OfflineCard';
import { loadSavedCard, type SavedCard } from '@/features/membership/savedCard';
import { chooseLanguage, type AppLanguage } from '@/lib/i18n';

const LANGUAGES: { key: AppLanguage; label: string }[] = [
  { key: 'ta', label: 'தமிழ்' },
  { key: 'en', label: 'English' },
];

/**
 * A01: the app's name, the language choice, and the way in. When the app
 * opens without a connection the stored session cannot be checked, so the
 * card saved at the last online visit is offered here (C03).
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { state, retry } = useSession();
  const unreachable = state.status === 'unreachable';
  const [saved, setSaved] = useState<SavedCard | null>(null);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    if (!unreachable) return;
    let active = true;
    void loadSavedCard().then((found) => active && setSaved(found));
    return () => {
      active = false;
    };
  }, [unreachable]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <AppText step="page" accessibilityRole="header" style={styles.center}>
          {t('m.welcome.title')}
        </AppText>
        <AppText step="section" tone="secondary" style={styles.center}>
          {t('m.welcome.titleOther')}
        </AppText>
        <AppText step="secondary" tone="muted" style={styles.center}>
          {t('m.welcome.subtitle')}
        </AppText>
      </View>

      {state.status === 'signed_out' && state.expired ? <Notice tone="warning">{t('m.welcome.expired')}</Notice> : null}
      {state.status === 'not_configured' ? <Notice tone="error">{t('m.welcome.notConfigured')}</Notice> : null}
      {unreachable ? (
        <View style={styles.gap}>
          <Notice tone="error">{t('m.welcome.unreachable')}</Notice>
          <Button label={t('m.common.retry')} variant="secondary" icon="refresh" onPress={retry} />
          {saved ? (
            <Button
              label={showCard ? t('m.card.hideSavedCard') : t('m.card.showSavedCard')}
              variant="quiet"
              icon={showCard ? 'chevron-up' : 'card-outline'}
              onPress={() => setShowCard(!showCard)}
            />
          ) : null}
          {saved && showCard ? <OfflineCard saved={saved} /> : null}
        </View>
      ) : null}

      <View style={styles.gap}>
        <AppText step="label">{t('m.welcome.chooseLanguage')}</AppText>
        <View style={styles.languages} accessibilityRole="radiogroup">
          {LANGUAGES.map((option) => {
            const active = option.key === language;
            return (
              <Pressable
                key={option.key}
                onPress={() => void chooseLanguage(option.key)}
                accessibilityRole="radio"
                aria-checked={active}
                style={[styles.language, active && styles.languageActive]}>
                <AppText step="section" tone={active ? 'inverse' : 'primary'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.gap}>
        <Button
          label={t('m.welcome.signIn')}
          icon="log-in-outline"
          disabled={state.status === 'not_configured'}
          onPress={() => router.push('/sign-in')}
        />
        <Button
          label={t('m.welcome.createAccount')}
          variant="secondary"
          icon="person-add-outline"
          disabled={state.status === 'not_configured'}
          onPress={() => router.push('/register')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing[2], paddingTop: spacing[8], paddingBottom: spacing[4] },
  logo: { width: 96, height: 96, borderRadius: radius.card },
  center: { textAlign: 'center' },
  gap: { gap: spacing[3] },
  languages: { flexDirection: 'row', gap: spacing[3] },
  language: {
    flex: 1,
    minHeight: control.height,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
