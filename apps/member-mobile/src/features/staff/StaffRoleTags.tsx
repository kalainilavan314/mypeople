import { StatusTag, useLanguage } from '@my-people/mobile-ui';

import { areaLabel, tierLabel } from '@/features/staff/areaLabel';
import type { MyStaffRoles } from '@/features/staff/useMyStaffRoles';

/** "Tier 3A · Jaffna district" for each staff role the person holds now; nothing for a member without one. */
export function StaffRoleTags({ roles }: { roles: MyStaffRoles }) {
  const language = useLanguage();
  return roles.assignments.map((assignment) => (
    <StatusTag
      key={assignment.id}
      tone="neutral"
      label={`${tierLabel(assignment, language)} · ${areaLabel(assignment, roles.areaNames, language)}`}
    />
  ));
}
