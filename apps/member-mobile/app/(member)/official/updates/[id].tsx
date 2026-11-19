import { useLocalSearchParams } from 'expo-router';

import { Screen, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { OfficialStatementView } from '@/features/official/OfficialStatementView';
import { api } from '@/lib/api';

/** M47 statement: the latest signed version, its check code, and the full revision history (FR-AUT-004). */
export default function OfficialStatementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statement = useApiQuery(() => api().getOfficialStatement(id), [id]);
  useReloadOnFocus(statement.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={statement.reload}
      refreshing={statement.loading && statement.data !== undefined}>
      <FeatureQueryView feature="official.updates" query={statement}>
        {(data) => <OfficialStatementView statement={data} />}
      </FeatureQueryView>
    </Screen>
  );
}
