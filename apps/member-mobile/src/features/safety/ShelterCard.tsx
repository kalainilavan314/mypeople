import type { Shelter } from '@my-people/api-client';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, formatDateTime, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { SHELTER_TONES } from './labels';

/**
 * A shelter from an authorised source (FR-DIS-006): its status, where it is, who reported it and when.
 * A report older than 12 hours says it may be out of date.
 */
export function ShelterCard({ shelter }: { shelter: Shelter }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const sourceUrl = shelter.sourceUrl;
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.tags}>
        <StatusTag tone={SHELTER_TONES[shelter.status]} label={t(`m.safety.shelter_${shelter.status}`)} />
        {shelter.outOfDate ? <StatusTag tone="pending" label={t('m.safety.mayBeOutOfDate')} /> : null}
      </View>
      <AppText step="card">{localized(shelter.nameEn, shelter.nameTa)}</AppText>
      <AppText step="secondary" tone="secondary">
        {localized(shelter.placeEn, shelter.placeTa)}
      </AppText>
      {shelter.capacity ? (
        <AppText step="secondary" tone="secondary">
          {t('m.safety.capacity', { count: shelter.capacity })}
        </AppText>
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.safety.reportedBy', {
          source: localized(shelter.sourceNameEn, shelter.sourceNameTa),
          time: formatDateTime(shelter.sourceReportedAt, language),
        })}
      </AppText>
      {sourceUrl ? (
        <Button
          label={t('m.safety.openSource')}
          variant="quiet"
          icon="open-outline"
          onPress={() => void Linking.openURL(sourceUrl)}
        />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
