import { useApiQuery } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/** Whether the renewal module is switched on, so the card tab offers its rows only then (FR-ARCH-011). */
export function useRenewalOpen(): boolean {
  const features = useApiQuery(() => api().getEnabledFeatures(), []);
  return features.data?.enabled.includes('renewal') ?? false;
}
