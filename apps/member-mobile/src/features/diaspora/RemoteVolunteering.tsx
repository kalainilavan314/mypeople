import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDate,
  IconTile,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

/**
 * FR-DSP-003: remote, skill-based volunteering, those matching the supporter's skills first. Offering
 * to help opens the volunteering briefing (H11), where the volunteering rules apply.
 */
export function RemoteVolunteering({ registered }: { registered: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const opportunities = useApiQuery(() => api().listDiasporaOpportunities(), [registered]);

  return (
    <View style={styles.section}>
      <AppText step="section" accessibilityRole="header">
        {t('m.diaspora.remoteTitle')}
      </AppText>
      <FeatureQueryView feature="diaspora" query={opportunities}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.diaspora.noRemote')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {items.map((item) => {
                const title = localized(item.titleEn, item.titleTa);
                const role = localized(item.roleEn, item.roleTa);
                return (
                  <SurfaceCard
                    key={item.id}
                    onPress={() => router.push({ pathname: '/volunteer/[id]', params: { id: item.id } })}
                    accessibilityLabel={[title, role, t('m.diaspora.remote'), item.matchesMySkills ? t('m.diaspora.matches') : null]
                      .filter(Boolean)
                      .join('. ')}
                    accessibilityHint={t('m.diaspora.opensBriefing')}>
                    <View style={styles.row}>
                      <IconTile icon="briefcase-outline" tint="brand" size={40} />
                      <View style={styles.text}>
                        <AppText step="card">{title}</AppText>
                        <AppText step="secondary" tone="secondary">
                          {role}
                        </AppText>
                        <AppText step="caption" tone="muted">
                          {t('m.diaspora.startsOn', { date: formatDate(item.startsAt, language) })}
                        </AppText>
                      </View>
                      <Ionicons
                        accessible={false}
                        name="chevron-forward"
                        size={iconSize.row}
                        color={colors.textMuted}
                        style={styles.arrow}
                      />
                    </View>
                    <View style={styles.tags}>
                      <StatusTag tone="neutral" label={t('m.diaspora.remote')} />
                      {item.matchesMySkills ? <StatusTag tone="verified" label={t('m.diaspora.matches')} /> : null}
                      <StatusTag tone="neutral" label={t('m.diaspora.placesLeft', { count: item.placesLeft })} />
                    </View>
                  </SurfaceCard>
                );
              })}
            </View>
          )
        }
      </FeatureQueryView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  list: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
  arrow: { flexShrink: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
