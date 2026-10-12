export type MemberTier = 'volunteer' | 'diamond' | 'gold' | 'platinum';

export interface TierDef {
  key: MemberTier;
  level: number;
  nameEn: string;
  nameTa: string;
  adminLevel: 'none' | 'gs' | 'ds' | 'district';
  seatLimit: number | null;
  requirementEn: string;
  color: string;
  grad: string;
}

export const TIERS: Record<MemberTier, TierDef> = {
  volunteer: {
    key: 'volunteer',
    level: 0,
    nameEn: 'Volunteer',
    nameTa: 'தன்னார்வலர்',
    adminLevel: 'none',
    seatLimit: null,
    requirementEn: 'Join the movement',
    color: '#8E98B7',
    grad: '#0F2942',
  },
  diamond: {
    key: 'diamond',
    level: 1,
    nameEn: 'Diamond',
    nameTa: 'வைரம்',
    adminLevel: 'gs',
    seatLimit: 2,
    requirementEn: 'Recruit 20% of your GS division',
    color: '#6EC6FF',
    grad: '#0F2942',
  },
  gold: {
    key: 'gold',
    level: 2,
    nameEn: 'Gold',
    nameTa: 'தங்கம்',
    adminLevel: 'ds',
    seatLimit: 3,
    requirementEn: 'Recruit 500 volunteers',
    color: '#FFCB6B',
    grad: '#0F2942',
  },
  platinum: {
    key: 'platinum',
    level: 3,
    nameEn: 'Platinum',
    nameTa: 'பிளாட்டினம்',
    adminLevel: 'district',
    seatLimit: 5,
    requirementEn: 'Recruit 1,000 people',
    color: '#D9E1F2',
    grad: '#0F2942',
  },
};

export const TIER_ORDER: MemberTier[] = ['volunteer', 'diamond', 'gold', 'platinum'];

export function tierDef(key: string | null | undefined): TierDef {
  return TIERS[key as MemberTier] ?? TIERS.volunteer;
}
