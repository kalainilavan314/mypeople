import { useLocalSearchParams } from 'expo-router';

import { CoordinatorTools } from '@/features/committees/coordinator/CoordinatorTools';

/**
 * S18 for a committee's coordinator or secretary from the committee space. A coordinator need not
 * hold a staff role (PRM-50 is committee-scoped, T0 included), so the tools are here as well as in
 * the Staff section; the API checks the committee role on every call.
 */
export default function CommitteeCoordinateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CoordinatorTools committeeId={id} />;
}
