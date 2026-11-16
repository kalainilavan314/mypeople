import { areaKeysToName, areaName, areaNamesFrom, type AreaLike, type AreaNames } from '@my-people/i18n/staff-terms';

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

type AssignmentLike = { tier: string; permissions: readonly string[]; area: { level: string; code?: string | null } };

/**
 * The areas a staff member may choose for a new record, from their own assignments that hold the
 * permission: "district:LK41" with the area's name and the tier. A platform-wide assignment has no
 * single area to offer; the picker's "another area" choice covers it. The API checks the area again.
 */
export async function areaOptionsFor(
  assignments: readonly AssignmentLike[],
  permission: string,
): Promise<{ value: string; label: string }[]> {
  const own = assignments.filter((a) => a.permissions.includes(permission) && a.area.level !== 'platform' && a.area.code);
  const names = await loadAreaNames(own.map((a) => a.area));
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];
  for (const assignment of own) {
    const value = `${assignment.area.level}:${assignment.area.code}`;
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: `${areaName(assignment.area, names, 'ta')} · ${areaName(assignment.area, names, 'en')} (Tier ${assignment.tier})` });
  }
  return options;
}
