import { useApiQuery } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

export type MyAreaKey = { level: 'district' | 'ds' | 'gn'; key: string; name: string | null };

/**
 * The member's district, DS division and GN division as area keys ("district:LK41"), for filters
 * such as "My district" on the Promise Tracker. Empty while loading or when no area is set.
 */
export function useMyAreaKeys(): MyAreaKey[] {
  const profile = useApiQuery(() => api().getMyProfile());
  const data = profile.data;
  if (!data) return [];
  const keys: MyAreaKey[] = [];
  if (data.districtCode) keys.push({ level: 'district', key: `district:${data.districtCode}`, name: data.districtName });
  if (data.dsCode) keys.push({ level: 'ds', key: `ds:${data.dsCode}`, name: data.dsName });
  if (data.gsCode) keys.push({ level: 'gn', key: `gn:${data.gsCode}`, name: data.gsName });
  return keys;
}
