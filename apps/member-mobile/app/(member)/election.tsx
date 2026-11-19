import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Notice, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ElectionCard } from '@/features/election/ElectionCard';
import { OfficialLinks } from '@/features/election/OfficialLinks';
import { api } from '@/lib/api';

/**
 * M29 Election information, only while the election_mode switch is on (FR-ELX-001 to 004, 010;
 * BR-129, BR-131; NFR-ELC-06). Neutral and sourced: the polling day and countdown from the Election
 * Commission's publication with its document and time, notices labelled "Election Commission
 * information" or "Party information", and links to the Commission's own services. Nothing about
 * how anyone votes is asked or recorded.
 *
 * [ASSUMPTION] DEP-19: the legal opinion on election features is not recorded yet. Until it is, the
 * switch stays off in production (Gate G2); this screen shows only what the Election Commission
 * publishes, so turning it on needs Legal Counsel's sign-off, not a code change.
 */
export default function ElectionInformationScreen() {
  const { t } = useTranslation();
  const information = useApiQuery(async () => {
    const [elections, links] = await Promise.all([api().getCurrentElections(), api().getElectionOfficialLinks()]);
    return { elections, links };
  });
  useReloadOnFocus(information.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={information.reload}
      refreshing={information.loading && information.data !== undefined}>
      <FeatureQueryView feature="election.info" query={information}>
        {({ elections, links }) => (
          <>
            <Notice tone="info" title={t('m.election.sourcesLabel')}>
              {t('m.election.sourcesBody')}
            </Notice>
            {elections.length === 0 ? (
              <SurfaceCard style={styles.card}>
                <AppText step="section" accessibilityRole="header">
                  {t('m.election.noElection')}
                </AppText>
                <AppText step="secondary" tone="secondary">
                  {t('m.election.noElectionBody')}
                </AppText>
              </SurfaceCard>
            ) : (
              <View style={styles.list}>
                {elections.map((election) => (
                  <ElectionCard key={election.periodRef} election={election} />
                ))}
              </View>
            )}
            <OfficialLinks links={links} />
            <AppText step="caption" tone="muted">
              {t('m.election.neverAsks')}
            </AppText>
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  list: { gap: spacing[5] },
});
