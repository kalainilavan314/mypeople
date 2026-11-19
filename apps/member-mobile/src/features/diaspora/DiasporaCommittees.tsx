import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, useApiQuery } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CommitteeCard } from '@/features/committees/CommitteeCard';
import { api } from '@/lib/api';

/**
 * FR-DSP-005: networking happens only inside approved diaspora committees, which follow committee
 * rules: a coordinator approves each person, and there are no direct messages.
 */
export function DiasporaCommittees({ registered }: { registered: boolean }) {
  const { t } = useTranslation();
  const committees = useApiQuery(() => api().listCommittees('diaspora'), [registered]);
  return (
    <View style={styles.section}>
      <AppText step="section" accessibilityRole="header">
        {t('m.diaspora.networkingTitle')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.diaspora.networkingBody')}
      </AppText>
      <FeatureQueryView feature="committees" query={committees}>
        {(items) => {
          const open = items.filter((item) => item.kind === 'committee');
          return open.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.diaspora.noCommittees')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {open.map((item) => (
                <CommitteeCard key={item.id} committee={item} />
              ))}
            </View>
          );
        }}
      </FeatureQueryView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  list: { gap: spacing[3] },
});
