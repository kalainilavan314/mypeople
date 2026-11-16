import type { AreaChoice } from './AreaFields';

export type ChosenArea = { level: 'district' | 'ds' | 'gn'; code: string };

/** The smallest area chosen in AreaFields: a GN division, else a DS division, else a district. */
export function chosenArea(area: AreaChoice): ChosenArea | null {
  if (area.gn) return { level: 'gn', code: area.gn };
  if (area.ds) return { level: 'ds', code: area.ds };
  if (area.district) return { level: 'district', code: area.district };
  return null;
}
