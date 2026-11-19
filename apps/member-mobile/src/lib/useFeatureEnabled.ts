import { useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * Whether a switchable module is on, for an entry point that should not appear at all while it is off
 * (FeaturesOut: "a module that is off is hidden, never shown broken"). Unknown or failed counts as off.
 */
export function useFeatureEnabled(key: string): boolean {
  const features = useApiQuery(() => api().getEnabledFeatures());
  useReloadOnFocus(features.reload);
  return features.data?.enabled.includes(key) ?? false;
}
