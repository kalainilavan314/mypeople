import type { ElectionPeriod } from '@my-people/api-client';

import type { TranslationDictionary } from '../../lib/i18n/types.ts';

type Words = TranslationDictionary['elections'];

export type SilenceStatus = 'active' | 'upcoming' | 'over' | 'stopped';

/**
 * Where a period's silence window stands at `now`. The API applies silence controls only while a
 * period is declared, so an ended or withdrawn period's window has stopped, whatever its dates say.
 */
export function silenceStatus(period: Pick<ElectionPeriod, 'state' | 'silenceStartsAt' | 'silenceEndsAt'>, now: Date): SilenceStatus {
  if (period.state !== 'declared') return 'stopped';
  if (now.getTime() < new Date(period.silenceStartsAt).getTime()) return 'upcoming';
  if (now.getTime() < new Date(period.silenceEndsAt).getTime()) return 'active';
  return 'over';
}

export function silenceText(status: SilenceStatus, words: Words): string {
  if (status === 'active') return words.silenceActive;
  if (status === 'upcoming') return words.silenceUpcoming;
  if (status === 'over') return words.silenceOver;
  return words.silenceStopped;
}

/**
 * The overlap warning travels to the period's page in the address after declaring, so only strings
 * shaped like period references (EP-0001) are accepted from it.
 */
export function overlapRefs(raw: string | undefined): string[] {
  return (raw ?? '').split(',').filter((ref) => /^EP-\d{1,10}$/.test(ref));
}

export function electionTypeText(type: ElectionPeriod['electionType'], words: Words): string {
  const names: Record<ElectionPeriod['electionType'], string> = {
    presidential: words.typePresidential,
    parliamentary: words.typeParliamentary,
    provincial: words.typeProvincial,
    local: words.typeLocal,
    referendum: words.typeReferendum,
  };
  return names[type] ?? type;
}

/** "platform" or "district:LK41", as the API names areas, in words. */
export function areaKeyText(areaKey: string, words: Words): string {
  if (areaKey === 'platform') return words.wholeCountry;
  const [level, code] = areaKey.split(':', 2);
  const levels: Record<string, string> = {
    province: words.levelProvince,
    district: words.levelDistrict,
    ds: words.levelDs,
    gn: words.levelGn,
  };
  return `${levels[level] ?? level} ${code ?? ''}`.trim();
}
