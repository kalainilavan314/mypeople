import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice } from '@my-people/mobile-ui';

import { useVoiceInput } from './useVoiceInput';
import type { VoiceLanguage, VoiceProblem } from './voiceTypes';

const PROBLEM_WORDS: Readonly<Record<VoiceProblem, string>> = {
  no_recognizer: 'm.voice.unavailable_no_recognizer',
  not_on_device: 'm.voice.unavailable_not_on_device',
  language: 'm.voice.unavailable_language',
  permission: 'm.voice.unavailable_permission',
  no_speech: 'm.voice.noSpeech',
  failed: 'm.voice.failed',
};

/**
 * "Speak instead" beside a text box (M43, FR-AIA-006): the words heard are added to the box, where the
 * member checks and corrects them before sending. Typing always works without it (BR-144).
 */
export function VoiceInput({ language, onTranscript }: { language: VoiceLanguage; onTranscript: (text: string) => void }) {
  const { t } = useTranslation();
  const [added, setAdded] = useState(false);
  const [download, setDownload] = useState<'started' | 'failed' | null>(null);
  const voice = useVoiceInput(language, (text) => {
    if (!text.trim()) return;
    onTranscript(text);
    setAdded(true);
  });

  const begin = () => {
    setAdded(false);
    setDownload(null);
    void voice.start();
  };

  return (
    <View style={styles.box}>
      {voice.listening ? (
        <View style={styles.listening}>
          <AppText step="label" tone="primary" accessibilityLiveRegion="polite">
            {t('m.voice.listening')}
          </AppText>
          {voice.interim ? (
            <View style={styles.heard}>
              <AppText step="caption" tone="muted">
                {t('m.voice.heard')}
              </AppText>
              <AppText step="body">{voice.interim}</AppText>
            </View>
          ) : null}
          <Button label={t('m.voice.stop')} icon="stop-circle-outline" variant="secondary" onPress={voice.stop} />
        </View>
      ) : (
        <Button
          label={t('m.voice.speak')}
          icon="mic-outline"
          variant="secondary"
          accessibilityHint={t('m.voice.speakHint')}
          onPress={begin}
        />
      )}
      {added && !voice.listening ? (
        <AppText step="secondary" tone="success" accessibilityLiveRegion="polite">
          {t('m.voice.added')}
        </AppText>
      ) : null}
      {voice.problem ? (
        <Notice tone="warning">
          {`${t(PROBLEM_WORDS[voice.problem])} ${t('m.voice.typingAlways')}`}
        </Notice>
      ) : null}
      {voice.problem === 'language' && voice.downloadable && download === null ? (
        <Button
          label={t('m.voice.download')}
          icon="cloud-download-outline"
          variant="quiet"
          onPress={() => void voice.download().then(setDownload)}
        />
      ) : null}
      {download ? (
        <AppText step="secondary" tone={download === 'started' ? 'secondary' : 'error'} accessibilityLiveRegion="polite">
          {t(download === 'started' ? 'm.voice.downloadStarted' : 'm.voice.downloadFailed')}
        </AppText>
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.voice.privacy')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[2] },
  listening: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: colors.primaryContainer,
  },
  heard: { gap: 2 },
});
