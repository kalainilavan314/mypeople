import type { TFunction } from 'i18next';

/**
 * The API describes a session's device in English, as "<platform> <app|browser>"
 * (services/api/app/modules/auth/device.py), e.g. "Android app" or "Other device browser".
 * This puts it in the member's language; platform names such as Android stay as they are.
 */
export function deviceName(t: TFunction, label: string): string {
  const match = /^(.*) (app|browser)$/.exec(label.trim());
  if (!match) return label;
  const platform = match[1] === 'Other device' ? t('m.profile.deviceUnknown') : match[1];
  return t(match[2] === 'app' ? 'm.profile.deviceApp' : 'm.profile.deviceBrowser', { platform });
}
