import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, SurfaceCard, useApiQuery, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * H01's election banner (FR-ELX-001): the soonest election running for the member's area, with its
 * polling day and countdown, citing the Election Commission; opens M29. It shows nothing while
 * election mode is off, when no election is running, or when it cannot load (Home stays usable).
 */
export function ElectionBanner() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const current = useApiQuery(() => api().getCurrentElections());
  const election = current.data?.[0];
  if (!election) return null;
  const title = localized(election.titleEn, election.titleTa);
  const label = localized(election.labelEn, election.labelTa);
  const countdown =
    election.daysToPolling === 0 ? t('m.election.pollingToday') : t('m.election.countdown', { count: election.daysToPolling });
  const day = `${t('m.election.pollingDay')}: ${formatDate(election.pollingDay, language)}`;

  return (
    <SurfaceCard
      accent
      variant="glass"
      onPress={() => router.push('/election')}
      accessibilityLabel={`${label}. ${title}. ${day}. ${countdown}`}
      accessibilityHint={t('m.election.bannerHint')}
      style={styles.card}>
      <AppText step="caption" tone="primary">
        {label}
      </AppText>
      <AppText step="section">{title}</AppText>
      <AppText step="secondary" tone="secondary">
        {`${day} · ${countdown}`}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing[1] } });
