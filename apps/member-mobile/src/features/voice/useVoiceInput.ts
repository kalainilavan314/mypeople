import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { pickLocale, problemFor, type VoiceControls, type VoiceLanguage, type VoiceProblem } from './voiceTypes';

// Google's on-device recogniser on Android; it lists which languages are installed for offline use.
const ON_DEVICE_SERVICE = 'com.google.android.as';

type Found = { locale: string } | { problem: VoiceProblem; downloadable?: string };

async function findLocale(language: VoiceLanguage): Promise<Found> {
  if (Platform.OS === 'android') {
    try {
      const { locales, installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
        androidRecognitionServicePackage: ON_DEVICE_SERVICE,
      });
      const installed = pickLocale(language, installedLocales);
      if (installed) return { locale: installed };
      const supported = pickLocale(language, locales);
      return supported ? { problem: 'language', downloadable: supported } : { problem: 'language' };
    } catch {
      // No on-device service: we cannot be sure the voice stays on the phone, so voice typing stays off.
      return { problem: 'not_on_device' };
    }
  }
  const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
  const locale = pickLocale(language, locales);
  return locale ? { locale } : { problem: 'language' };
}

/**
 * Android and iOS: the platform recogniser with requiresOnDeviceRecognition, so the audio never
 * leaves the device. Where it cannot promise that, voice typing does not start.
 */
export function useVoiceInput(language: VoiceLanguage, onFinal: (text: string) => void): VoiceControls {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [problem, setProblem] = useState<VoiceProblem | null>(null);
  const [downloadLocale, setDownloadLocale] = useState<string | null>(null);
  const active = useRef(false);
  const finalHandler = useRef(onFinal);
  useEffect(() => {
    finalHandler.current = onFinal;
  });
  useEffect(
    () => () => {
      if (active.current) ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  useSpeechRecognitionEvent('result', (event) => {
    if (!active.current) return;
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setInterim('');
      finalHandler.current(text);
    } else {
      setInterim(text);
    }
  });
  useSpeechRecognitionEvent('end', () => {
    active.current = false;
    setListening(false);
    setInterim('');
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    active.current = false;
    setListening(false);
    setProblem(problemFor(event.error));
  });

  const start = useCallback(async () => {
    setProblem(null);
    setDownloadLocale(null);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setProblem('no_recognizer');
        return;
      }
      if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
        setProblem('not_on_device');
        return;
      }
      const found = await findLocale(language);
      if ('problem' in found) {
        setProblem(found.problem);
        setDownloadLocale(found.downloadable ?? null);
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setProblem('permission');
        return;
      }
      active.current = true;
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: found.locale,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
      });
    } catch {
      active.current = false;
      setListening(false);
      setProblem('failed');
    }
  }, [language]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const download = useCallback(async (): Promise<'started' | 'failed'> => {
    if (!downloadLocale || Platform.OS !== 'android') return 'failed';
    try {
      await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: downloadLocale });
      return 'started';
    } catch {
      return 'failed';
    }
  }, [downloadLocale]);

  return { listening, interim, problem, downloadable: downloadLocale !== null && Platform.OS === 'android', download, start, stop };
}
