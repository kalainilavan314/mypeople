import type { Assignment } from '@my-people/api-client';

/** "district LK41" or "platform": the area an assignment covers, as the API names it. */
export function areaLabel(assignment: Assignment): string {
  return assignment.area.level === 'platform' ? 'platform' : `${assignment.area.level} ${assignment.area.code}`;
}

/** "Tier 3A": the BRD's names for the tiers are on the dashboard; the app shows the tier. */
export function tierLabel(assignment: Assignment): string {
  return `Tier ${assignment.tier}`;
}
