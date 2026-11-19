import type { TFunction } from 'i18next';
import { Linking } from 'react-native';

import { showMessage } from '@my-people/mobile-ui';

/**
 * Opens an Election Commission page in the browser (FR-ELX-002): nothing is sent to or kept by this
 * app. If the phone cannot open it, the member is told the address to visit instead of nothing happening.
 */
export function openOfficialLink(t: TFunction, url: string): void {
  Linking.openURL(url).catch(() => showMessage(t('m.election.infoTitle'), t('m.election.linkFailed', { url })));
}
