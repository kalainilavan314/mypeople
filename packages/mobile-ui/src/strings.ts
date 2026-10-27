// Text shown by the shared components. The Tamil here is new (it is not in the
// PWA's resources yet) and must be reviewed by a Tamil speaker before release.
const strings = {
  en: {
    notBuilt: 'Not built yet',
    notBuiltDetail: 'This screen arrives in a later release.',
    serverConnection: 'Server connection',
    checking: 'Checking…',
    connected: 'Connected',
    unavailable: 'Server unavailable',
    unreachable: 'Unable to reach the server',
    notConfigured: 'Server address is not set',
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
    notBuilt: 'இன்னும் உருவாக்கப்படவில்லை',
    notBuiltDetail: 'இந்தத் திரை பின்னர் வரும் பதிப்பில் சேர்க்கப்படும்.',
    serverConnection: 'சேவையக இணைப்பு',
    checking: 'சரிபார்க்கிறது…',
    connected: 'இணைக்கப்பட்டது',
    unavailable: 'சேவையகம் கிடைக்கவில்லை',
    unreachable: 'சேவையகத்தை அணுக முடியவில்லை',
    notConfigured: 'சேவையக முகவரி அமைக்கப்படவில்லை',
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
