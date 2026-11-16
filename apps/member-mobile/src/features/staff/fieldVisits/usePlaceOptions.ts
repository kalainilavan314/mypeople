import type { FieldVisit, Place } from '@my-people/api-client';
import { areaKey, areaName, areaNamesFrom, type AreaLike } from '@my-people/i18n/staff-terms';
import { useApiQuery, useLanguage } from '@my-people/mobile-ui';
import { useTranslation } from 'react-i18next';

import { deviceDraftStorage } from '@/lib/deviceDraft';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

import { FIELD_COLLECT } from './concerns';

/** A GN or DS division a visit can be recorded in; `key` is the area key, e.g. "gn:J0101" or "ds:J01". */
export type PlaceOption = { key: string; nameEn: string | null; nameTa: string | null };

/** The place of a visit on the phone or from the server: a GN, a DS, or neither. */
export type VisitPlace = { gnCode: string | null; dsCode: string | null; areaKey?: string };

// The GN and DS divisions of the coordinator's own areas, kept on the phone so a visit can be
// recorded without signal. They are public place names, not member data.
const cache = deviceDraftStorage('field-place-options.json', 'mp.fieldPlaceOptions');

const option =
  (level: 'gn' | 'ds') =>
  ({ code, nameEn, nameTa }: Place): PlaceOption => ({ key: `${level}:${code}`, nameEn, nameTa });

async function dsAndItsGns(ds: PlaceOption): Promise<PlaceOption[]> {
  const code = ds.key.slice('ds:'.length);
  return [ds, ...(await api().listGnDivisions(code)).map(option('gn'))];
}

async function districtPlaces(districtCode: string): Promise<PlaceOption[]> {
  const divisions = (await api().listDsDivisions(districtCode)).map(option('ds'));
  return (await Promise.all(divisions.map(dsAndItsGns))).flat();
}

/** Every GN and DS division inside one area where the coordinator collects. */
async function placesUnder(level: string, code: string | null, named: Map<string, PlaceOption>): Promise<PlaceOption[]> {
  const known = (key: string): PlaceOption => named.get(key) ?? { key, nameEn: null, nameTa: null };
  if (level === 'gn' && code) return [known(`gn:${code}`)];
  if (level === 'ds' && code) return dsAndItsGns(known(`ds:${code}`));
  if (level === 'district' && code) return districtPlaces(code);
  if (level === 'province' || level === 'platform') {
    // District codes begin with their province's code (ISO 3166-2:LK: province LK4 holds LK41 to LK45).
    const districts = (await api().listDistricts()).filter((district) => level === 'platform' || (code !== null && district.code.startsWith(code)));
    return (await Promise.all(districts.map((district) => districtPlaces(district.code)))).flat();
  }
  return [];
}

/**
 * The places a coordinator may record visits in (S05, FR-FLD-003): the GN and DS divisions of every
 * area where they hold field.collect, chosen by hand; the phone's location is never used. A visit
 * may also have no place when the coordinator collects in exactly one area: it is then counted under
 * that area. Offline, the last list fetched is used.
 */
export function usePlaceOptions() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { assignments, areaNames } = useStaff();
  const collecting = assignments.filter((assignment) => assignment.permissions.includes(FIELD_COLLECT));
  const areas = [...new Set(collecting.map((assignment) => areaKey(assignment.area)))].sort();
  const areasKey = areas.join(',');
  /** The one area a visit without a place is counted under; null when the coordinator must choose. */
  const singleArea = areas.length === 1 ? (areas[0] ?? null) : null;

  const options = useApiQuery(async () => {
    try {
      const keys = areasKey.split(',').filter(Boolean);
      const lookup = keys.filter((key) => key.startsWith('gn:') || key.startsWith('ds:'));
      const named = new Map(
        (lookup.length > 0 ? await api().listAreaNames(lookup) : []).map((item) => [
          item.key,
          { key: item.key, nameEn: item.nameEn, nameTa: item.nameTa },
        ]),
      );
      const lists = await Promise.all(
        keys.map((key) => {
          const [level = '', code = null] = key.split(':');
          return placesUnder(level, code, named);
        }),
      );
      const unique = new Map(lists.flat().map((place) => [place.key, place]));
      // DS divisions first, then GN divisions, each by name.
      const found = [...unique.values()].sort(
        (a, b) => Number(a.key.startsWith('gn:')) - Number(b.key.startsWith('gn:')) || (a.nameEn ?? a.key).localeCompare(b.nameEn ?? b.key),
      );
      await cache.write(JSON.stringify({ areas: areasKey, options: found }));
      return { options: found, saved: false };
    } catch (error) {
      const saved = await cache.read();
      const parsed = saved ? (JSON.parse(saved) as { areas?: string; options?: PlaceOption[] }) : null;
      if (parsed?.areas === areasKey && Array.isArray(parsed.options)) return { options: parsed.options, saved: true };
      throw error;
    }
  }, [areasKey]);

  const placeNames = areaNamesFrom(options.data?.options.map((place) => ({ ...place })) ?? []);
  const areaText = (area: AreaLike) => areaName(area, areaNames, language);
  /** "Nallur DS division", "Ariyalai GN division"; the code until names are known. */
  const nameOf = (key: string) => areaName(key, placeNames, language);
  /** The words for a visit's place; a visit without one names the area it is counted under. */
  const label = (place: VisitPlace) => {
    if (place.gnCode) return nameOf(`gn:${place.gnCode}`);
    if (place.dsCode) return nameOf(`ds:${place.dsCode}`);
    const counted = place.areaKey ?? singleArea;
    return counted ? t('s.fieldVisits.noPlaceIn', { area: areaText(counted) }) : t('s.fieldVisits.noPlace');
  };
  return { query: options, nameOf, label, singleArea, singleAreaText: singleArea ? areaText(singleArea) : null };
}

/** The place of a visit the server holds, for label(). */
export function syncedPlace(visit: FieldVisit): VisitPlace {
  return { gnCode: visit.gnCode ?? null, dsCode: visit.dsCode ?? null, areaKey: visit.areaKey };
}
