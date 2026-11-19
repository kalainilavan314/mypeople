import type { SafetyHome } from '@my-people/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  formatDateTime,
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useMember,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { AreaFields, NO_AREA, type AreaChoice } from '@/features/area/AreaFields';
import { chosenArea } from '@/features/area/chosenArea';
import { useAreaName } from '@/features/area/useAreaName';
import { AlertCard } from '@/features/safety/AlertCard';
import { OFFLINE_EMERGENCY_CONTACTS } from '@/features/safety/labels';
import { NotDispatchNotice } from '@/features/safety/NotDispatchNotice';
import { readSavedAlerts, saveAlerts } from '@/features/safety/savedAlerts';
import { ShelterCard } from '@/features/safety/ShelterCard';
import { EmergencyNumbers } from '@/features/support/EmergencyNumbers';
import { api } from '@/lib/api';
import { noAnswer } from '@/lib/errors';

/**
 * M35 Alerts and safety: the statement that this app relays official warnings and sends no help, the
 * emergency numbers, the current warnings for the member's home area (or an area they choose; never
 * GPS), nearby shelters from authorised sources, emergency help (M36) and relief volunteering. Open to
 * everyone signed in. The last alerts stay on the phone with their time for when the connection drops.
 */
export default function AlertsScreen() {
  const { t } = useTranslation();
  const [area, setArea] = useState<AreaChoice>(NO_AREA);
  const [choosing, setChoosing] = useState(false);
  const chosen = chosenArea(area);
  const areaKey = chosen ? `${chosen.level}:${chosen.code}` : null;

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.safety.areaHeading')}
        </AppText>
        {choosing ? (
          <>
            <AppText step="secondary" tone="secondary">
              {t('m.safety.chooseAreaHint')}
            </AppText>
            <AreaFields value={area} onChange={setArea} />
            <Button
              label={t('m.safety.useHomeArea')}
              variant="quiet"
              icon="home-outline"
              onPress={() => {
                setArea(NO_AREA);
                setChoosing(false);
              }}
            />
          </>
        ) : (
          <Button label={t('m.safety.chooseArea')} variant="secondary" icon="location-outline" onPress={() => setChoosing(true)} />
        )}
      </SurfaceCard>
      {/* A fresh query for each area, so alerts of one area are never shown under another. */}
      <AreaAlerts key={areaKey ?? 'home'} areaKey={areaKey} />
    </Screen>
  );
}

function AreaAlerts({ areaKey }: { areaKey: string | null }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const member = useMember();
  const home = useApiQuery(() => api().getSafetyHome(areaKey ?? undefined), [areaKey]);
  useReloadOnFocus(home.reload);
  const [saved, setSaved] = useState<SafetyHome | null>(null);
  const offline = home.data === undefined && !home.loading && noAnswer(home.error);

  useEffect(() => {
    if (home.data) void saveAlerts(member.id, areaKey, home.data);
  }, [home.data, member.id, areaKey]);
  useEffect(() => {
    if (!offline) return;
    let active = true;
    void readSavedAlerts(member.id, areaKey).then((copy) => active && setSaved(copy));
    return () => {
      active = false;
    };
  }, [offline, member.id, areaKey]);

  if (offline && saved) {
    return (
      <>
        <Notice tone="warning" title={t('m.safety.offlineTitle')}>
          {t('m.safety.offlineSaved', { time: formatDateTime(saved.checkedAt, language) })}
        </Notice>
        <Button label={t('m.common.retry')} variant="secondary" icon="refresh-outline" onPress={home.reload} />
        <SafetyBody data={saved} areaKey={areaKey} offline />
      </>
    );
  }
  return (
    <>
      {offline ? (
        <>
          <NotDispatchNotice />
          <EmergencyNumbers contacts={[...OFFLINE_EMERGENCY_CONTACTS]} lead={t('m.safety.emergencyLead')} />
        </>
      ) : null}
      <FeatureQueryView feature="safety" query={home}>
        {(data) => <SafetyBody data={data} areaKey={areaKey} offline={false} />}
      </FeatureQueryView>
      {home.data?.checkedAt ? (
        <AppText step="caption" tone="muted">
          {t('m.safety.checkedAt', { time: formatDateTime(home.data.checkedAt, language) })}
        </AppText>
      ) : null}
    </>
  );
}

function SafetyBody({ data, areaKey, offline }: { data: SafetyHome; areaKey: string | null; offline: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const mostLocal = data.areaKeys.length ? data.areaKeys[data.areaKeys.length - 1] : null;
  const areaName = useAreaName(mostLocal);
  const firstCurrent = data.current[0]?.id;

  return (
    <View style={styles.body}>
      <NotDispatchNotice />
      <EmergencyNumbers contacts={data.emergencyContacts} lead={t('m.safety.emergencyLead')} />

      {data.areaKeys.length === 0 ? (
        <Notice tone="info" title={t('m.safety.noAreaTitle')}>
          {t('m.safety.noAreaBody')}
        </Notice>
      ) : (
        <AppText step="secondary" tone="secondary">
          {areaKey ? t('m.safety.showingChosen', { area: areaName ?? '' }) : t('m.safety.showingHome', { area: areaName ?? '' })}
        </AppText>
      )}

      <AppText step="section" accessibilityRole="header">
        {t('m.safety.currentHeading')}
      </AppText>
      {data.current.length === 0 ? (
        <SurfaceCard>
          <AppText step="body" tone="secondary">
            {t('m.safety.noCurrent')}
          </AppText>
        </SurfaceCard>
      ) : (
        data.current.map((alert) => <AlertCard key={alert.id} alert={alert} />)
      )}
      {!offline ? (
        <Button
          label={t('m.safety.pastAlerts')}
          variant="quiet"
          icon="time-outline"
          onPress={() => router.push({ pathname: '/alerts/history', params: areaKey ? { area: areaKey } : {} })}
        />
      ) : null}

      <AppText step="section" accessibilityRole="header">
        {t('m.safety.sheltersHeading')}
      </AppText>
      {data.shelters.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.safety.noShelters')}
        </AppText>
      ) : (
        data.shelters.map((shelter) => <ShelterCard key={shelter.id} shelter={shelter} />)
      )}

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.safety.helpHeading')}
        </AppText>
        <AppText step="body" tone="secondary">
          {t('m.safety.helpIntro')}
        </AppText>
        <Button
          label={t('m.safety.askForHelp')}
          icon="alert-circle-outline"
          onPress={() => router.push({ pathname: '/alerts/help', params: firstCurrent ? { alertId: firstCurrent } : {} })}
        />
      </SurfaceCard>

      {!offline ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.safety.reliefHeading')}
          </AppText>
          <AppText step="body" tone="secondary">
            {data.reliefOffer
              ? t('m.safety.reliefOffered', { date: formatDate(data.reliefOffer.availableUntil, language) })
              : t('m.safety.reliefIntro')}
          </AppText>
          {data.reliefOfferLock ? (
            <AppText step="secondary" tone="muted">
              {t(`m.safety.reliefLock_${data.reliefOfferLock}`)}
            </AppText>
          ) : (
            <Button
              label={data.reliefOffer ? t('m.safety.reliefChange') : t('m.safety.reliefOffer')}
              variant="secondary"
              icon="people-outline"
              onPress={() => router.push('/alerts/volunteer')}
            />
          )}
        </SurfaceCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  card: { gap: spacing[3] },
});
