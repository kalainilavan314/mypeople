// Text shown by the shared components. The Tamil here is new (it is not in the
// PWA's resources yet) and must be reviewed by a Tamil speaker before release.
const strings = {
  en: {
    tryAgain: 'Try again',
    loading: 'Loading…',
    loadFailed: 'This could not be loaded.',
    optional: 'Optional',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    close: 'Close',
    search: 'Search',
  },
  ta: {
    tryAgain: 'மீண்டும் முயலவும்',
    loading: 'ஏற்றுகிறது…',
    loadFailed: 'இதனை ஏற்ற முடியவில்லை.',
    optional: 'விருப்பத்தேர்வு',
    showPassword: 'கடவுச்சொல்லைக் காட்டு',
    hidePassword: 'கடவுச்சொல்லை மறை',
    close: 'மூடு',
    search: 'தேடு',
  },
} as const;

export function stringsFor(language: string) {
  return language === 'ta' ? strings.ta : strings.en;
}
