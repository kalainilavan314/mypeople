import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, MenuRow, Screen, SurfaceCard, useApiQuery, useLocalized, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

/** S18: the committees this person coordinates or is secretary of, with how much waits in each. */
export default function StaffCommitteesScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const committees = useApiQuery(() => api().listCoordinatedCommittees(), []);
  useReloadOnFocus(committees.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={committees.reload}
      refreshing={committees.loading && committees.data !== undefined}>
      <FeatureQueryView feature="committees" query={committees}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('s.committees.none')}
            </AppText>
          ) : (
            <SurfaceCard style={styles.rows}>
              {items.map((entry, index) => (
                <MenuRow
                  key={entry.committee.id}
                  first={index === 0}
                  icon="people-outline"
                  tint="teal"
                  label={localized(entry.committee.nameEn, entry.committee.nameTa)}
                  hint={`${t(`m.committees.role_${entry.role}`)} · ${t('m.committees.waitingCount', { count: entry.waiting })}`}
                  onPress={() => router.push({ pathname: '/staff/committees/[id]', params: { id: entry.committee.id } })}
                />
              ))}
            </SurfaceCard>
          )
        }
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { paddingVertical: 0 },
});
