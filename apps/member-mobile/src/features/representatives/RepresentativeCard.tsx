import type { RepresentativeSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDateTime,
  IconTile,
  StatusTag,
  SurfaceCard,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { useAreaName } from '@/features/area/useAreaName';

/** One role profile in M41: name, role, the area covered, office hours and the next free time. */
export function RepresentativeCard({ representative }: { representative: RepresentativeSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const area = useAreaName(representative.areaKey) ?? representative.areaKey;
  const name = localized(representative.displayNameEn, representative.displayNameTa);
  const role = localized(representative.roleEn, representative.roleTa);
  const next = representative.nextOpenSlot
    ? t('m.representatives.nextFree', { time: formatDateTime(representative.nextOpenSlot, language) })
    : t('m.representatives.noSlots');

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/representatives/[id]', params: { id: representative.id } })}
      accessibilityLabel={[name, role, area, representative.coversMyArea ? t('m.representatives.coversYou') : null, next]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t('m.representatives.opensProfile')}>
      <View style={styles.row}>
        <IconTile icon="person-outline" tint="teal" size={40} />
        <View style={styles.text}>
          <AppText step="card">{name}</AppText>
          <AppText step="secondary" tone="secondary">
            {role}
          </AppText>
          <AppText step="secondary" tone="muted">
            {area}
          </AppText>
        </View>
      </View>
      {representative.coversMyArea ? <StatusTag tone="verified" label={t('m.representatives.coversYou')} /> : null}
      <AppText step="caption" tone="muted">
        {next}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
