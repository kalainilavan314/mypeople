import type { Assignment } from '@my-people/api-client';
import { areaName, type AreaNames, type StaffLanguage } from '@my-people/i18n/staff-terms';

/** "Jaffna district" / "யாழ்ப்பாணம் மாவட்டம்": the area an assignment covers; its code until names load. */
export function areaLabel(assignment: Assignment, names: AreaNames | undefined, language: StaffLanguage): string {
  return areaName(assignment.area, names, language);
}

/** "Tier 3A": the BRD's names for the tiers are on the dashboard; the app shows the tier. */
export function tierLabel(assignment: Assignment): string {
  return `Tier ${assignment.tier}`;
}
