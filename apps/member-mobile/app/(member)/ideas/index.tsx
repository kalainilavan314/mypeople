import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '@my-people/mobile-ui';

import { IdeasTab } from '@/features/ideas/IdeasTab';
import { ProposalsTab } from '@/features/proposals/ProposalsTab';

type Tab = 'ideas' | 'proposals';

/**
 * One Ideas area: Community ideas (H13) and Development proposals (M15) share it. A notice or
 * activity item can open it on its tab (?tab=proposals).
 */
export default function IdeasScreen() {
  const { t } = useTranslation();
  const { tab: param } = useLocalSearchParams<{ tab?: string }>();
  const initial: Tab = param === 'proposals' ? 'proposals' : 'ideas';
  const [tab, setTab] = useState<Tab>(initial);
  useEffect(() => setTab(initial), [initial]);

  const switcher = (
    <SegmentedControl
      label={t('m.ideas.show')}
      selected={tab}
      onSelect={setTab}
      options={[
        { key: 'ideas', label: t('m.ideas.tabIdeas') },
        { key: 'proposals', label: t('m.ideas.tabProposals') },
      ]}
    />
  );
  return tab === 'ideas' ? <IdeasTab switcher={switcher} /> : <ProposalsTab switcher={switcher} />;
}
