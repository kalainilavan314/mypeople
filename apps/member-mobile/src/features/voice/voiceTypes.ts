/**
 * Voice typing (M43, FR-VOI-001, FR-AIA-006): speech is turned into text on the device only, and the
 * member edits the words before anything is sent. No recording is ever uploaded or kept (15B.7).
 * useVoiceInput.ts is the Android and iOS version; useVoiceInput.web.ts the browser one.
 */

export type VoiceLanguage = 'ta' | 'en';

/** Why voice typing cannot run now; the screen says so and typing stays available (BR-144). */
export type VoiceProblem =
  | 'no_recognizer'
  | 'not_on_device'
  | 'language'
  | 'permission'
  | 'no_speech'
  | 'failed';

export type VoiceControls = {
  listening: boolean;
  /** The words heard so far, before the recogniser settles on them. */
  interim: string;
  problem: VoiceProblem | null;
  /** The language can be installed for on-device use (then `download` starts it). */
  downloadable: boolean;
  download: () => Promise<'started' | 'failed'>;
  start: () => Promise<void>;
  stop: () => void;
};

/** Locales tried for each language, closest to Sri Lankan speech first. */
export const VOICE_LOCALES: Readonly<Record<VoiceLanguage, readonly string[]>> = {
  ta: ['ta-LK', 'ta-IN', 'ta'],
  en: ['en-LK', 'en-IN', 'en-GB', 'en-US'],
};

const normalise = (locale: string) => locale.replace('_', '-').toLowerCase();

/** The first wanted locale the device offers, matching "ta" to "ta-IN" when only the bare language is listed. */
export function pickLocale(language: VoiceLanguage, offered: readonly string[]): string | null {
  const available = offered.map(normalise);
  for (const wanted of VOICE_LOCALES[language]) {
    const index = available.indexOf(normalise(wanted));
    if (index >= 0) return offered[index];
  }
  const sameLanguage = available.findIndex((locale) => locale.split('-')[0] === language);
  return sameLanguage >= 0 ? offered[sameLanguage] : null;
}

/** The recogniser's error codes, in the app's words. */
export function problemFor(code: string): VoiceProblem {
  switch (code) {
    case 'not-allowed':
      return 'permission';
    case 'no-speech':
    case 'speech-timeout':
      return 'no_speech';
    case 'language-not-supported':
      return 'language';
    case 'service-not-allowed':
    case 'network':
      return 'not_on_device';
    default:
      return 'failed';
  }
}

/** Adds the spoken words to what is already typed, with one space between. */
export function appendTranscript(current: string, spoken: string): string {
  const words = spoken.trim();
  if (!words) return current;
  return current.trim() ? `${current.replace(/\s+$/, '')} ${words}` : words;
}
