import type { ProposalCategory } from '@my-people/api-client';

import { CATEGORIES } from './stages.ts';

type Cell = { areaKey: string; category: ProposalCategory; count: number | null };

/**
 * FR-DEV-008: the API's cells as a table, areas down (in the API's order: districts, then DS
 * divisions where the numbers allow) and only the categories that have a cell across. A null count
 * is "fewer than 10"; undefined means no proposals in that area and category.
 */
export function needsTable(cells: readonly Cell[]): {
  areas: string[];
  categories: ProposalCategory[];
  count: (area: string, category: ProposalCategory) => number | null | undefined;
} {
  const areas = [...new Set(cells.map((cell) => cell.areaKey))];
  const used = new Set(cells.map((cell) => cell.category));
  const categories = CATEGORIES.filter((category) => used.has(category));
  const counts = new Map(cells.map((cell) => [`${cell.areaKey}|${cell.category}`, cell.count]));
  return {
    areas,
    categories,
    count: (area, category) => (counts.has(`${area}|${category}`) ? counts.get(`${area}|${category}`) : undefined),
  };
}
