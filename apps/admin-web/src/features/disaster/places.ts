import 'server-only';

import { areaName } from '@my-people/i18n/staff-terms';

import { loadAreaNames } from '@/lib/areas';
import { staffApi } from '@/lib/session';
import type { StaffContext } from '@/lib/staff';

export type PlaceOption = { value: string; label: string };

/**
 * The divisions a staff member may pick for a shelter, a store or a delivery: their own DS and GN areas
 * for the permission, and the DS divisions of their own districts. Anything smaller is typed as a key;
 * the API checks every area again. A failed lookup gives the own areas only.
 */
export async function divisionOptions(staff: StaffContext, permission: string): Promise<PlaceOption[]> {
  const own = staff.assignments.filter((a) => a.permissions.includes(permission) && a.area.code);
  const options: PlaceOption[] = [];
  const seen = new Set<string>();
  const add = (value: string, label: string) => {
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, label });
  };
  const names = await loadAreaNames(own.map((a) => a.area));
  for (const assignment of own) {
    const key = `${assignment.area.level}:${assignment.area.code}`;
    if (assignment.area.level === 'ds' || assignment.area.level === 'gn' || assignment.area.level === 'district') {
      add(key, `${areaName(assignment.area, names, 'ta')} · ${areaName(assignment.area, names, 'en')}`);
    }
  }
  const api = await staffApi();
  for (const assignment of own.filter((a) => a.area.level === 'district')) {
    try {
      for (const division of await api.listDsDivisions(assignment.area.code as string)) {
        add(`ds:${division.code}`, `${division.nameTa ?? division.code} · ${division.nameEn ?? division.code}`);
      }
    } catch {
      // The district itself is still offered.
    }
  }
  return options;
}
