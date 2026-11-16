import type { Idea } from '@my-people/api-client';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

import { IdeaCard } from './IdeaCard';
import { ModerationNotice } from './ModerationNotice';

/** H13 Community ideas: published ideas in the member's area, and the member's own with their state. */
export function IdeasTab({ switcher }: { switcher: ReactNode }) {
  const { t } = useTranslation();
  const board = useApiQuery(() => api().getIdeaBoard());
  useReloadOnFocus(board.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={board.reload} refreshing={board.loading && board.data !== undefined}>
      {switcher}
      <FeatureQueryView feature="ideas" query={board}>
        {(data) => (
          <>
            <SurfaceCard style={styles.card}>
              <AppText step="body" tone="secondary">
                {t('m.ideas.intro')}
              </AppText>
              <ModerationNotice />
              <Button label={t('m.ideas.shareIdea')} icon="bulb-outline" onPress={() => router.push('/ideas/new')} />
            </SurfaceCard>
            <IdeaList heading={t('m.ideas.localHeading')} empty={t('m.ideas.noLocal')} ideas={data.local} reload={board.reload} />
            <IdeaList heading={t('m.ideas.mineHeading')} empty={t('m.ideas.noMine')} ideas={data.mine} reload={board.reload} />
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

function IdeaList({ heading, empty, ideas, reload }: { heading: string; empty: string; ideas: Idea[]; reload: () => void }) {
  return (
    <View style={styles.list}>
      <AppText step="section" accessibilityRole="header">
        {heading}
      </AppText>
      {ideas.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {empty}
        </AppText>
      ) : (
        ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} onChanged={reload} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  list: { gap: spacing[3] },
});
