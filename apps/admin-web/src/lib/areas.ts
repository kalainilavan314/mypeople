import { areaKeysToName, areaNamesFrom, type AreaLike, type AreaNames } from '@my-people/i18n/staff-terms';

import { staffApi } from '@/lib/session';

const MAX_KEYS = 100; // the API's limit per lookup

/**
 * The names of the areas a page shows, in one call to the API. Names only replace codes on screen,
 * so a failed lookup gives an empty map and the page shows the codes instead of failing.
 */
export async function loadAreaNames(areas: readonly (AreaLike | null | undefined)[]): Promise<AreaNames> {
  const keys = areaKeysToName(areas.filter((area): area is AreaLike => area != null)).slice(0, MAX_KEYS);
  if (keys.length === 0) return new Map();
  try {
    return areaNamesFrom(await (await staffApi()).listAreaNames(keys));
  } catch {
    return new Map();
  }
}
