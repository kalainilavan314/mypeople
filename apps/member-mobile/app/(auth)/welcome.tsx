import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText, Button, Notice, Screen, readOfflineCard, type OfflineCardPreview, useLanguage, useSession } from '@my-people/mobile-ui';

import { OfflineCard } from '@/features/membership/OfflineCard';
import { WelcomeSlides } from '@/features/welcome/WelcomeSlides';
import { chooseLanguage, type AppLanguage } from '@/lib/i18n';

const LANGUAGES: { key: AppLanguage; label: string }[] = [
  { key: 'ta', label: 'தமிழ்' },
  { key: 'en', label: 'English' },
];

/** A01: the app's name, the language choice, and the way in. */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { state, retry } = useSession();
  const [offlineCard, setOfflineCard] = useState<OfflineCardPreview | null>(null);
  useEffect(() => {
    if (state.status !== 'unreachable') return;
    let active = true;
    void readOfflineCard().then((saved) => { if (active) setOfflineCard(saved); });
    return () => { active = false; };
  }, [state.status]);

  return (
    <Screen edges={['top', 'bottom']} maxContentWidth={560}>
      <View style={styles.hero}>
        <WelcomeSlides />
        <View style={styles.heroCopy}>
          <AppText step="page" accessibilityRole="header" style={styles.centred}>
            {t('m.welcome.title')}
          </AppText>
          <AppText step="section" tone="secondary" style={styles.centred}>
            {t('m.welcome.titleOther')}
          </AppText>
          <AppText step="secondary" tone="muted" style={styles.centred}>
            {t('m.welcome.subtitle')}
          </AppText>
        </View>
      </View>

      {state.status === 'signed_out' && state.expired ? <Notice tone="warning">{t('m.welcome.expired')}</Notice> : null}
      {state.status === 'not_configured' ? <Notice tone="error">{t('m.welcome.notConfigured')}</Notice> : null}
      {state.status === 'unreachable' ? (
        <View style={styles.gap}>
          <Notice tone="error">{t('m.welcome.unreachable')}</Notice>
          {offlineCard ? <OfflineCard preview={offlineCard} /> : null}
          <Button label={t('m.common.retry')} variant="secondary" icon="refresh" onPress={retry} />
        </View>
      ) : null}

      <View style={styles.languageGroup}>
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
                <AppText step="section" tone={active ? 'brandAccent' : 'primary'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('m.welcome.signIn')}
          disabled={state.status === 'not_configured'}
          onPress={() => router.push('/sign-in')}
        />
        <Button
          label={t('m.welcome.createAccount')}
          variant="secondary"
          disabled={state.status === 'not_configured'}
          onPress={() => router.push('/register')}
        />
        {/* S11: Community Support needs no account; the public form is open to anyone. */}
        <Button
          label={t('m.support.welcomeLink')}
          variant="quiet"
          disabled={state.status === 'not_configured'}
          onPress={() => router.push('/help/support')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing[2],
    borderRadius: radius.card,
    backgroundColor: colors.primaryContainer,
    overflow: 'hidden',
  },
  // The three names sit centred under the pictures, one above the other.
  heroCopy: { gap: spacing[1], padding: spacing[4], alignItems: 'center' },
  centred: { textAlign: 'center' },
  gap: { gap: spacing[3] },
  languageGroup: { gap: spacing[2], marginTop: spacing[2] },
  actions: { gap: spacing[3], marginTop: spacing[2] },
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
  languageActive: { backgroundColor: colors.brandYellow, borderColor: colors.brandGold },
});
