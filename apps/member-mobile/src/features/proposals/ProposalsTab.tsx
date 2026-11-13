import type { ProposalSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Screen, SearchField, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

import { ProposalCard } from './ProposalCard';

// Waits for a pause in typing before asking the server again.
const SEARCH_DELAY_MS = 400;

/**
 * M15 Development proposals: published proposals for the member's area and their own, with a
 * plain word search over titles, problems, solutions and references.
 */
export function ProposalsTab({ switcher }: { switcher: ReactNode }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [words, setWords] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setWords(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const board = useApiQuery(() => api().getProposalBoard(words ? { q: words } : undefined), [words]);
  useReloadOnFocus(board.reload);

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={board.reload} refreshing={board.loading && board.data !== undefined}>
      {switcher}
      <FeatureQueryView feature="proposals" query={board}>
        {(data) => (
          <>
            <SurfaceCard style={styles.card}>
              <AppText step="body" tone="secondary">
                {t('m.proposals.intro')}
              </AppText>
              <Button label={t('m.proposals.newProposal')} icon="document-text-outline" onPress={() => router.push('/ideas/proposals/new')} />
            </SurfaceCard>
            <SearchField label={t('m.proposals.search')} value={text} onChangeText={setText} returnKeyType="search" />
            <AppText step="caption" tone="muted">
              {t('m.proposals.searchHint')}
            </AppText>
            <ProposalList heading={t('m.proposals.areaHeading')} empty={words ? t('m.proposals.noMatches') : t('m.proposals.noArea')} items={data.area} />
            <ProposalList heading={t('m.proposals.mineHeading')} empty={words ? t('m.proposals.noMatches') : t('m.proposals.noMine')} items={data.mine} />
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

function ProposalList({ heading, empty, items }: { heading: string; empty: string; items: ProposalSummary[] }) {
  return (
    <View style={styles.list}>
      <AppText step="section" accessibilityRole="header">
        {heading}
      </AppText>
      {items.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {empty}
        </AppText>
      ) : (
        items.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  list: { gap: spacing[3] },
});
