import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Notice, Screen, SurfaceCard, TextField, useApiAction, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** A15: optional answers are saved only when the member chooses to provide them. */
export default function SurveyScreen() {
  const { t } = useTranslation();
  const answers = useApiQuery(() => api().getSurveyAnswers());
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
      <Screen edges={['bottom']}>
        <QueryView query={answers}>{(saved) => <SurveyForm saved={saved} />}</QueryView>
        <Button label={t('m.setup.skip')} variant="quiet" onPress={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function SurveyForm({ saved }: { saved: Record<string, string> }) {
  const { t } = useTranslation();
  const [occupation, setOccupation] = useState(saved.occupation ?? '');
  const [interests, setInterests] = useState(saved.interests ?? '');
  const save = useApiAction(async () => {
    const answers = { ...saved };
    for (const [key, value] of [['occupation', occupation.trim()], ['interests', interests.trim()]]) {
      if (value) answers[key] = value;
      else delete answers[key];
    }
    await api().replaceSurveyAnswers(answers);
    router.back();
  });
  return (
    <SurfaceCard accent>
      <AppText step="section" accessibilityRole="header">{t('m.setup.surveyTitle')}</AppText>
      <AppText step="body" tone="secondary">{t('m.setup.surveyHint')}</AppText>
      <TextField label={t('m.setup.occupation')} optional value={occupation} onChangeText={setOccupation} maxLength={200} />
      <TextField label={t('m.setup.interests')} optional value={interests} onChangeText={setInterests} multiline maxLength={200} />
      {save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}
      <Button label={t('m.setup.saveSurvey')} busy={save.busy} onPress={() => void save.run()} />
    </SurfaceCard>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 } });
