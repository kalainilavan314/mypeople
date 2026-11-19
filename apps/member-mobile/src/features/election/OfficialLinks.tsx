import type { ElectionOfficialLinks } from '@my-people/api-client';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, spacing } from '@my-people/design-tokens/mobile';
import { AppText, MenuRow, StatusTag, SurfaceCard, useLocalized } from '@my-people/mobile-ui';

import { openOfficialLink } from './openOfficialLink';

/**
 * FR-ELX-002, 003: the Election Commission's own services, opened in the browser. The app collects no
 * voter-registration data and has no polling-station locator of its own until an authorised dataset
 * exists (OD-37); the Commission's site shows the polling station instead.
 */
export function OfficialLinks({ links }: { links: ElectionOfficialLinks }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.election.officialLinks')}
      </AppText>
      <StatusTag tone="neutral" label={localized(links.labelEn, links.labelTa)} />
      <AppText step="secondary" tone="secondary">
        {t('m.election.officialLinksIntro')}
      </AppText>
      {links.links.map((link, index) => (
        <MenuRow
          key={link.key}
          first={index === 0}
          icon={link.key === 'polling_station' ? 'location-outline' : link.key === 'voter_registration' ? 'search-outline' : 'document-text-outline'}
          label={localized(link.labelEn, link.labelTa)}
          hint={localized(link.descriptionEn, link.descriptionTa)}
          trailing={<Ionicons name="open-outline" size={iconSize.chevron} color={colors.controlBorder} />}
          onPress={() => openOfficialLink(t, link.url)}
        />
      ))}
      {!links.pollingStationLocator ? (
        <AppText step="caption" tone="muted">
          {t('m.election.locatorHidden')}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing[3] } });
