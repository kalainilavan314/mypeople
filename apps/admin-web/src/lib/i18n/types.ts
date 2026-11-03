export type Locale = 'ta' | 'en';

export const SUPPORTED_LOCALES: readonly Locale[] = ['ta', 'en'] as const;

export const DEFAULT_LOCALE: Locale = 'ta';

export const LOCALE_COOKIE_NAME = 'admin_locale';

export function isSupportedLocale(value: unknown): value is Locale {
  return value === 'ta' || value === 'en';
}

export type TranslationDictionary = {
  locale: Locale;
  brand: {
    title: string;
    subtitle: string;
    metaTitle: string;
    metaDescription: string;
  };
  nav: {
    dashboard: string;
    verification: string;
    appeals: string;
    duplicates: string;
    membership: string;
    events: string;
    gallery: string;
    messages: string;
    settings: string;
    access: string;
    audit: string;
    accessReviews: string;
    signOut: string;
    checkingSession: string;
  };
  common: {
    reference: string;
    actions: string;
    status: string;
    date: string;
    area: string;
    member: string;
    tier: string;
    reason: string;
    note: string;
    confirm: string;
    cancel: string;
    claim: string;
    release: string;
    back: string;
    filter: string;
    all: string;
    loading: string;
    empty: string;
    save: string;
    search: string;
    required: string;
    optional: string;
    language: string;
    switchLanguage: string;
    tamil: string;
    english: string;
    preview: string;
    edit: string;
    delete: string;
    view: string;
    open: string;
    closed: string;
    state: string;
    details: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    workQueues: string;
    systemStatus: string;
    plannedModules: string;
    noQueues: string;
    viewQueue: string;
    openCount: string;
  };
  settings: {
    title: string;
    subtitle: string;
    languageCardTitle: string;
    languageCardDesc: string;
    languageSaved: string;
    featuresTitle: string;
    featuresDesc: string;
    electionsTitle: string;
    electionsDesc: string;
  };
  auth: {
    signInTitle: string;
    signInSubtitle: string;
    idNumberLabel: string;
    passwordLabel: string;
    signInButton: string;
    signingIn: string;
    mfaTitle: string;
    mfaSubtitle: string;
    mfaInstruction: string;
    codeLabel: string;
    verifyButton: string;
    verifying: string;
    sessionEnded: string;
  };
  verification: {
    title: string;
    subtitle: string;
    detailTitle: string;
    detailSubtitle: string;
    evidenceTitle: string;
    checklistTitle: string;
    approve: string;
    requestUpdate: string;
    decline: string;
    checklistComplete: string;
  };
  appeals: {
    title: string;
    subtitle: string;
    detailTitle: string;
    detailSubtitle: string;
    upheld: string;
    overturned: string;
  };
  duplicates: {
    title: string;
    subtitle: string;
    detailTitle: string;
    detailSubtitle: string;
    duplicateConfirmed: string;
    notDuplicate: string;
  };
  membership: {
    title: string;
    subtitle: string;
    lookupTitle: string;
    lookupPlaceholder: string;
    activate: string;
    suspend: string;
    reinstate: string;
    inactivate: string;
  };
  access: {
    title: string;
    subtitle: string;
    assignTitle: string;
    previewTitle: string;
    confirmTitle: string;
    confirmButton: string;
    cancelButton: string;
    revokeButton: string;
    reviewDue: string;
    confirmationText: string;
    previewNotice: string;
  };
  accessReviews: {
    title: string;
    subtitle: string;
    recertify: string;
    endAssignment: string;
  };
  audit: {
    title: string;
    subtitle: string;
    actor: string;
    action: string;
    target: string;
    ipAddress: string;
    time: string;
  };
  events: {
    title: string;
    subtitle: string;
    newTitle: string;
    editTitle: string;
    createButton: string;
    checkinWindow: string;
  };
  gallery: {
    title: string;
    subtitle: string;
    albumsTab: string;
    removalsTab: string;
    newAlbum: string;
  };
  messages: {
    title: string;
    subtitle: string;
    newTitle: string;
    createButton: string;
    scheduledAt: string;
  };
};
