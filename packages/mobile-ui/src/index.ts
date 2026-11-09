// Shared by the member and staff apps: the locked fonts, the screen components
// from the design specification (design/mobile/production-design-specification.md
// §3), the stored session, and the hooks that load data through the API client.
export { fontFamilyFor, lockedFonts, monoFontFamily, scaledTextStyle, textStyle } from './fonts';
export {
  DisplayPreferencesProvider,
  TEXT_SCALE,
  useDisplayPreferences,
  useTextScale,
  type TextSize,
} from './display/DisplayPreferences';
export { tabIcon } from './tabIcon';

export { AppText } from './components/AppText';
export { AuthorizedImage } from './components/AuthorizedImage';
export { Button } from './components/Button';
export { Checkbox } from './components/Checkbox';
export { ChipRow } from './components/ChipRow';
export { DateBadge } from './components/DateBadge';
export { MenuRow } from './components/MenuRow';
export { Notice } from './components/Notice';
export { QrCode } from './components/QrCode';
export { QueryView, createQueryView } from './components/QueryView';
export { Screen } from './components/Screen';
export { SelectField, type SelectOption } from './components/SelectField';
export { StatusTag, type Tone } from './components/StatusTag';
export { SurfaceCard } from './components/SurfaceCard';
export { TextField } from './components/TextField';

export { sessionEnded, useApiAction, useApiQuery, type Loaded } from './hooks/useApi';
export { useLanguage, useLocalized, type AppLanguage } from './hooks/useLanguage';
export { useReloadOnFocus } from './hooks/useReloadOnFocus';
export { useRotatingCode } from './hooks/useRotatingCode';

export { dateBadgeParts, formatDate, formatDateTime, formatSpan, formatTime, localHour } from './lib/format';
export { headerOptions } from './lib/headerOptions';
export {
  clearSavedCard,
  clearSession,
  deviceId,
  readDisplayPreferences,
  readLanguage,
  readRefreshToken,
  readSavedCard,
  readToken,
  saveCard,
  saveDisplayPreferences,
  saveLanguage,
  saveTokens,
  type StoredDisplayPreferences,
} from './lib/storage';

export { api, freshToken } from './session/api';
export { SessionProvider, useMember, useSession, type SessionState } from './session/SessionProvider';
