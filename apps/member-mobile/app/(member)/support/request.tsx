import { router, useLocalSearchParams } from 'expo-router';

import { Screen, useApiQuery } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { isSupportCategory } from '@/features/support/labels';
import { RequestFlow } from '@/features/support/RequestFlow';
import { api } from '@/lib/api';

/**
 * M12 Ask for support, for any signed-in person: membership is never needed or asked about. The
 * request then opens as M13 with its AS- reference.
 */
export default function SupportRequestScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const home = useApiQuery(() => api().getSupportHome());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="support" query={home}>
        {(data) => (
          <RequestFlow
            contacts={data.emergencyContacts}
            categories={data.categories}
            initialCategory={isSupportCategory(category) ? category : null}
            onSend={async (input) => {
              const sent = await api().requestSupport(input);
              router.replace({ pathname: '/support/[id]', params: { id: sent.id, receipt: '1' } });
            }}
          />
        )}
      </FeatureQueryView>
    </Screen>
  );
}
