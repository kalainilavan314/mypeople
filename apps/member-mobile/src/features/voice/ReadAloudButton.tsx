import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button } from '@my-people/mobile-ui';

import type { VoiceLanguage } from './voiceTypes';

const SPEECH_LANGUAGE: Readonly<Record<VoiceLanguage, string>> = { ta: 'ta-IN', en: 'en-GB' };

/**
 * Optional read-aloud (FR-AIA-006, FR-VOI-002) with the device's own voices. When the device lists its
 * voices and none speaks the language, it says so instead of reading in the wrong voice.
 */
export function ReadAloudButton({ text, language }: { text: string; language: VoiceLanguage }) {
  const { t } = useTranslation();
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const mine = useRef(false);

  useEffect(
    () => () => {
      if (mine.current) void Speech.stop();
    },
    [],
  );

  const toggle = async () => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    setNoVoice(false);
    const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
    const match = voices.find((voice) => voice.language.toLowerCase().startsWith(language));
    if (voices.length > 0 && !match) {
      setNoVoice(true);
      return;
    }
    await Speech.stop();
    mine.current = true;
    setSpeaking(true);
    const finished = () => {
      mine.current = false;
      setSpeaking(false);
    };
    Speech.speak(text, {
      language: match?.language ?? SPEECH_LANGUAGE[language],
      voice: match?.identifier,
      onDone: finished,
      onStopped: finished,
      onError: finished,
    });
  };

  return (
    <View style={styles.box}>
      <Button
        label={speaking ? t('m.voice.stopReading') : t('m.voice.readAloud')}
        icon={speaking ? 'stop-circle-outline' : 'volume-high-outline'}
        variant="quiet"
        onPress={() => void toggle()}
      />
      {noVoice ? (
        <AppText step="secondary" tone="muted" accessibilityLiveRegion="polite">
          {t('m.voice.noVoice')}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[1] },
});
