import { useLocalSearchParams } from 'expo-router';

import { CoordinatorTools } from '@/features/committees/coordinator/CoordinatorTools';

/** S18 Committee coordinator tools in the Staff section, for one committee the person coordinates. */
export default function StaffCommitteeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CoordinatorTools committeeId={id} />;
}
