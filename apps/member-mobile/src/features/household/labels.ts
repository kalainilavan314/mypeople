import type { Household, HouseholdMember, HouseholdPlace } from '@my-people/api-client';
import type { TFunction } from 'i18next';

/** The choices an adult has for their own entry (OD-30), in the order the API lists them. */
export const AGE_BANDS = ['18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const OCCUPATIONS = [
  'farming',
  'fishing',
  'daily_labour',
  'trade',
  'government',
  'private_sector',
  'self_employed',
  'student',
  'homemaker',
  'retired',
  'unemployed',
  'other',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

/** A child's relationship to the guardian who records them (OD-31). */
export const CHILD_RELATIONSHIPS = ['child', 'grandchild', 'sibling', 'other'] as const;
export type ChildRelationship = (typeof CHILD_RELATIONSHIPS)[number];

/** Who is an adult with an account (head or adult), and who is a child's minimum record. */
export function adultsOf(household: Household): HouseholdMember[] {
  return household.members.filter((member) => member.role !== 'dependent');
}

export function childrenOf(household: Household): HouseholdMember[] {
  return household.members.filter((member) => member.role === 'dependent');
}

/** The head, or the child's guardian, may correct or delete a child's record. */
export function canManageChild(household: Household, child: HouseholdMember): boolean {
  return household.isHead || (Boolean(child.guardianMemberId) && child.guardianMemberId === household.myMemberId);
}

export function relationshipLabel(t: TFunction, member: HouseholdMember): string {
  if (member.role === 'dependent') {
    return t(`m.household.childRelationships.${member.relationship}`, member.relationship);
  }
  return t(`m.household.relationships.${member.relationship}`, member.relationship);
}

/** "District: Jaffna", in the reader's language when the registry has that name. */
export function placeLine(
  t: TFunction,
  localized: (english: string, tamil: string) => string,
  place: HouseholdPlace,
): string {
  const name = localized(place.nameEn ?? place.code, place.nameTa ?? '');
  return `${t(`m.household.places.${place.level}`)}: ${name}`;
}

/** A first name with no digits (the API refuses digits so an ID or phone cannot be stored). */
export function validFirstName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 50 && !/\d/.test(value);
}

/** A four-digit year for someone under 18 this year. */
export function validChildBirthYear(value: string, thisYear = new Date().getFullYear()): boolean {
  if (!/^\d{4}$/.test(value.trim())) return false;
  const year = Number(value.trim());
  return year <= thisYear && thisYear - year < 18;
}
