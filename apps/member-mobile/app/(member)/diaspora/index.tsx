import type { DiasporaMe } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  MenuRow,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { DiasporaCommittees } from '@/features/diaspora/DiasporaCommittees';
import { InternationalEvents } from '@/features/diaspora/InternationalEvents';
import { zoneCity } from '@/features/diaspora/labels';
import { RemoteVolunteering } from '@/features/diaspora/RemoteVolunteering';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M46 Diaspora participation: register as a supporter abroad (separately from identity verification),
 * international events in Sri Lanka time and the supporter's own, remote volunteering, projects for
 * the home area and diaspora committees. Contributions from abroad stay switched off (OD-40): there is
 * no payment path here, and the screen says so.
 */
export default function DiasporaScreen() {
  const me = useApiQuery(() => api().getMyDiaspora(), []);
  useReloadOnFocus(me.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={me.reload} refreshing={me.loading && me.data !== undefined}>
      <FeatureQueryView feature="diaspora" query={me}>
        {(data) => <DiasporaView me={data} reload={me.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function DiasporaView({ me, reload }: { me: DiasporaMe; reload: () => void }) {
  const { t } = useTranslation();
  const supporter = me.supporter;
  const registered = supporter !== null && supporter !== undefined;
  const withdraw = useApiAction(async () => {
    await api().withdrawMyDiaspora();
    reload();
  });

  return (
    <>
      <AppText step="body" tone="secondary">
        {t('m.diaspora.intro')}
      </AppText>

      {!me.contributions.available ? (
        <Notice tone="warning" title={t('m.diaspora.contributionsOffTitle')}>
          {t('m.diaspora.contributionsOffBody')}
        </Notice>
      ) : null}

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.diaspora.yourDetails')}
        </AppText>
        {supporter ? (
          <>
            <AppText step="body">
              {t('m.diaspora.livesIn', { country: t(`m.diaspora.country_${supporter.countryCode}`, { defaultValue: supporter.countryCode }) })}
            </AppText>
            <AppText step="secondary" tone="secondary">
              {t('m.diaspora.timeZoneIs', { zone: zoneCity(supporter.timeZone) })}
            </AppText>
            <AppText step="secondary" tone="secondary">
              {supporter.contactTopics.length > 0
                ? t('m.diaspora.toldAbout', {
                    topics: supporter.contactTopics.map((topic) => t(`m.diaspora.topic_${topic}`)).join(', '),
                  })
                : t('m.diaspora.toldAboutNothing')}
            </AppText>
            <Button variant="secondary" icon="globe-outline" label={t('m.diaspora.update')} onPress={() => router.push('/diaspora/register')} />
            {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error, 'diaspora')}</Notice> : null}
            <Button
              variant="quiet"
              label={t('m.diaspora.withdraw')}
              busy={withdraw.busy}
              onPress={async () => {
                const sure = await confirmAction({
                  title: t('m.diaspora.withdraw'),
                  message: t('m.diaspora.withdrawConfirm'),
                  confirmLabel: t('m.diaspora.withdraw'),
                  cancelLabel: t('m.common.cancel'),
                  destructive: true,
                });
                if (sure) void withdraw.run();
              }}
            />
          </>
        ) : (
          <>
            <AppText step="secondary" tone="secondary">
              {t('m.diaspora.notRegistered')}
            </AppText>
            <Button icon="globe-outline" label={t('m.diaspora.register')} onPress={() => router.push('/diaspora/register')} />
          </>
        )}
      </SurfaceCard>

      <InternationalEvents registered={registered} />
      <RemoteVolunteering registered={registered} />

      <View style={styles.section}>
        <AppText step="section" accessibilityRole="header">
          {t('m.diaspora.proposalsTitle')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.diaspora.proposalsBody')}
        </AppText>
        <SurfaceCard style={styles.rowCard}>
          <MenuRow
            first
            icon="document-text-outline"
            tint="teal"
            label={t('m.diaspora.propose')}
            hint={t('m.diaspora.proposeHint')}
            onPress={() => router.push('/ideas/proposals/new')}
          />
        </SurfaceCard>
      </View>

      <DiasporaCommittees registered={registered} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  section: { gap: spacing[3] },
  rowCard: { paddingVertical: 0 },
});
