import type { Place } from '@my-people/api-client';
import { useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { deviceDraftStorage } from '@/lib/deviceDraft';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

import { FIELD_COLLECT } from './concerns';

export type GnOption = { code: string; nameEn: string | null; nameTa: string | null };

// The GN divisions of the coordinator's own areas, kept on the phone so a visit can be recorded
// without signal. They are public place names, not member data.
const cache = deviceDraftStorage('field-gn-options.json', 'mp.fieldGnOptions');

async function gnUnder(level: string, code: string): Promise<GnOption[]> {
  const pick = (places: Place[]) => places.map(({ code: gn, nameEn, nameTa }) => ({ code: gn, nameEn, nameTa }));
  if (level === 'gn') return [{ code, nameEn: null, nameTa: null }];
  if (level === 'ds') return pick(await api().listGnDivisions(code));
  if (level === 'district') {
    const divisions = await api().listDsDivisions(code);
    const lists = await Promise.all(divisions.map((ds) => api().listGnDivisions(ds.code)));
    return lists.flatMap(pick);
  }
  return [];
}

/**
 * The GN divisions a coordinator may record visits in: those of every area where they hold
 * field.collect (FR-FLD-003). Chosen by hand; the phone's location is never used. Offline, the
 * last list fetched is used.
 */
export function useGnOptions() {
  const language = useLanguage();
  const { assignments } = useStaff();
  const areas = assignments
    .filter((assignment) => assignment.permissions.includes(FIELD_COLLECT) && assignment.area.code)
    .map((assignment) => `${assignment.area.level}:${assignment.area.code}`)
    .sort()
    .join(',');

  const options = useApiQuery(async () => {
    try {
      const lists = await Promise.all(
        areas.split(',').filter(Boolean).map((key) => {
          const [level = '', code = ''] = key.split(':');
          return gnUnder(level, code);
        }),
      );
      const unique = new Map(lists.flat().map((option) => [option.code, option]));
      const found = [...unique.values()];
      await cache.write(JSON.stringify({ areas, options: found }));
      return { options: found, saved: false };
    } catch (error) {
      const saved = await cache.read();
      const parsed = saved ? (JSON.parse(saved) as { areas?: string; options?: GnOption[] }) : null;
      if (parsed?.areas === areas && Array.isArray(parsed.options)) return { options: parsed.options, saved: true };
      throw error;
    }
  }, [areas]);

  const label = (code: string) => {
    const found = options.data?.options.find((option) => option.code === code);
    const name = found ? (language === 'ta' ? found.nameTa : null) ?? found.nameEn : null;
    return name ?? code;
  };
  return { query: options, label };
}
