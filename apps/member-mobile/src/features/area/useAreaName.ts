import { areaName, areaNamesFrom } from '@my-people/i18n/staff-terms';
import { useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * "Jaffna district" / "யாழ்ப்பாணம் மாவட்டம்" for an area key such as "district:LK41"; the level and
 * code until the name loads (or if it cannot be), never a blank.
 */
export function useAreaName(key: string | null): string | null {
  const language = useLanguage();
  const names = useApiQuery(async () => (key ? areaNamesFrom(await api().listAreaNames([key])) : null), [key]);
  return key ? areaName(key, names.data ?? undefined, language) : null;
}
