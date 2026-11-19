import { useCallback, useEffect, useRef, useState } from 'react';

import { problemFor, VOICE_LOCALES, type VoiceControls, type VoiceLanguage, type VoiceProblem } from './voiceTypes';

/**
 * The browser's speech recognition, used only where it can run on the device (the Web Speech API's
 * processLocally). Older browsers send the audio to an online service, so there voice typing stays
 * off and the member types instead.
 */

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';
type LocalOptions = { langs: string[]; processLocally: boolean };

type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally: boolean;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionClass = {
  new (): Recognition;
  prototype: object;
  available?: (options: LocalOptions) => Promise<Availability>;
  install?: (options: LocalOptions) => Promise<boolean>;
};

function recognitionClass(): RecognitionClass | null {
  const scope = globalThis as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** The first locale this browser can recognise on the device, or why none can be used. */
async function findLocale(
  Recognition: RecognitionClass,
  language: VoiceLanguage,
): Promise<{ locale: string } | { problem: VoiceProblem; downloadable?: string }> {
  if (!('processLocally' in Recognition.prototype) || typeof Recognition.available !== 'function') {
    return { problem: 'not_on_device' };
  }
  let downloadable: string | undefined;
  for (const locale of VOICE_LOCALES[language]) {
    const state = await Recognition.available({ langs: [locale], processLocally: true }).catch(
      () => 'unavailable' as const,
    );
    if (state === 'available') return { locale };
    if ((state === 'downloadable' || state === 'downloading') && !downloadable) downloadable = locale;
  }
  return { problem: 'language', downloadable };
}

export function useVoiceInput(language: VoiceLanguage, onFinal: (text: string) => void): VoiceControls {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [problem, setProblem] = useState<VoiceProblem | null>(null);
  const [downloadLocale, setDownloadLocale] = useState<string | null>(null);
  const current = useRef<Recognition | null>(null);
  const finalHandler = useRef(onFinal);
  useEffect(() => {
    finalHandler.current = onFinal;
  });
  useEffect(() => () => current.current?.abort(), []);

  const start = useCallback(async () => {
    setProblem(null);
    setDownloadLocale(null);
    const Recognition = recognitionClass();
    if (!Recognition) {
      setProblem('no_recognizer');
      return;
    }
    const found = await findLocale(Recognition, language);
    if ('problem' in found) {
      setProblem(found.problem);
      setDownloadLocale(found.downloadable ?? null);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = found.locale;
    recognition.processLocally = true;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let heard = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalHandler.current(result[0].transcript);
        else heard += result[0].transcript;
      }
      setInterim(heard);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setProblem(problemFor(event.error));
    };
    recognition.onend = () => {
      current.current = null;
      setListening(false);
      setInterim('');
    };
    current.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      current.current = null;
      setListening(false);
      setProblem('failed');
    }
  }, [language]);

  const stop = useCallback(() => current.current?.stop(), []);

  const download = useCallback(async (): Promise<'started' | 'failed'> => {
    const Recognition = recognitionClass();
    if (!Recognition?.install || !downloadLocale) return 'failed';
    const started = await Recognition.install({ langs: [downloadLocale], processLocally: true }).catch(() => false);
    return started ? 'started' : 'failed';
  }, [downloadLocale]);

  return { listening, interim, problem, downloadable: downloadLocale !== null, download, start, stop };
}
