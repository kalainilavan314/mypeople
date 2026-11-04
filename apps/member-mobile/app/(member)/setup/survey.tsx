import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Notice, Screen, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** A15: optional answers are saved only when the member chooses to provide them. */
export default function SurveyScreen() {
  const { t } = useTranslation(); const [occupation, setOccupation] = useState(''); const [interests, setInterests] = useState('');
  const save = useApiAction(async () => { await api().replaceSurveyAnswers(Object.fromEntries([['occupation', occupation.trim()], ['interests', interests.trim()]].filter(([, value]) => value))); router.back(); });
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: 'height' })}><Screen edges={['bottom']}><SurfaceCard accent><AppText step="section" accessibilityRole="header">{t('m.setup.surveyTitle')}</AppText><AppText step="body" tone="secondary">{t('m.setup.surveyHint')}</AppText><TextField label={t('m.setup.occupation')} optional value={occupation} onChangeText={setOccupation} /><TextField label={t('m.setup.interests')} optional value={interests} onChangeText={setInterests} multiline maxLength={200} />{save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}<Button label={t('m.setup.saveSurvey')} busy={save.busy} onPress={() => void save.run()} /><Button label={t('m.setup.skip')} variant="quiet" onPress={() => router.back()} /></SurfaceCard></Screen></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1 } });
