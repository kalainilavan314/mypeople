import type { RepresentativeDetail } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  IconTile,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { SlotList } from '@/features/representatives/SlotList';
import { api } from '@/lib/api';

/**
 * M41 profile and the start of M42: the role, the District, DS or GN covered, office hours, the
 * contact routes the person approved (BR-143) and the free appointment times. With no times
 * published, "No appointments available" and the office hours show instead (FR-APT-002).
 */
export default function RepresentativeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const representative = useApiQuery(() => api().getRepresentative(id), [id]);
  useReloadOnFocus(representative.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={representative.reload}
      refreshing={representative.loading && representative.data !== undefined}>
      <FeatureQueryView feature="representatives" query={representative}>
        {(data) => <Profile representative={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function Profile({ representative }: { representative: RepresentativeDetail }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const area = useAreaName(representative.areaKey) ?? representative.areaKey;
  const contacts = representative.contacts;
  const address = contacts.officeAddressEn ? localized(contacts.officeAddressEn, contacts.officeAddressTa ?? '') : null;
  const anyContact = Boolean(contacts.phone || contacts.email || address);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <IconTile icon="person-outline" tint="teal" />
          <View style={styles.headerText}>
            <AppText step="page" accessibilityRole="header">
              {localized(representative.displayNameEn, representative.displayNameTa)}
            </AppText>
            <AppText step="body" tone="secondary">
              {localized(representative.roleEn, representative.roleTa)}
            </AppText>
          </View>
        </View>
        <DetailRow label={t('m.representatives.covers')} value={area} />
        {representative.coversMyArea ? <StatusTag tone="verified" label={t('m.representatives.coversYou')} /> : null}
      </View>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.officeHours')}
        </AppText>
        <AppText step="body">{localized(representative.officeHoursEn, representative.officeHoursTa)}</AppText>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.contact')}
        </AppText>
        {anyContact ? (
          <>
            {address ? <DetailRow label={t('m.representatives.office')} value={address} /> : null}
            {contacts.phone ? (
              <Button
                label={t('m.representatives.call', { phone: contacts.phone })}
                icon="call-outline"
                variant="secondary"
                onPress={() => void Linking.openURL(`tel:${contacts.phone}`)}
              />
            ) : null}
            {contacts.email ? (
              <Button
                label={t('m.representatives.email', { email: contacts.email })}
                icon="mail-outline"
                variant="secondary"
                onPress={() => void Linking.openURL(`mailto:${contacts.email}`)}
              />
            ) : null}
          </>
        ) : (
          <AppText step="secondary" tone="muted">
            {t('m.representatives.noContacts')}
          </AppText>
        )}
      </SurfaceCard>

      <View style={styles.section}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.bookTitle')}
        </AppText>
        {representative.slots.length === 0 ? (
          <Notice tone="info" title={t('m.representatives.noSlots')}>
            {t('m.representatives.noSlotsBody')}
          </Notice>
        ) : (
          <>
            <AppText step="secondary" tone="secondary">
              {t('m.representatives.bookIntro')}
            </AppText>
            <SlotList
              slots={representative.slots}
              onChoose={(slot) =>
                router.push({
                  pathname: '/representatives/book',
                  params: { representativeId: representative.id, slotId: slot.id },
                })
              }
            />
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  card: { gap: spacing[3] },
  section: { gap: spacing[3] },
});
