import type { RegisteredStaffDevice } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  scaledTextStyle,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useMember,
  useTextScale,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { forgetScannerDevice, scannerDeviceId } from '@/features/scan/offlineQueue';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** The server's limit of active phones per staff member (operations service, register_device). */
const ACTIVE_LIMIT = 5;

type Phones = { devices: RegisteredStaffDevice[]; thisPhoneId: string | null };

/**
 * The phones registered for offline check-in with the signed-in staff member's
 * account (GET /v1/operations/devices: own phones only, events.checkin_scan),
 * and withdrawing one after a confirmation step. Without this a staff member
 * at the five-phone limit (active_device_limit_reached) could not register a
 * new phone. Withdrawing stops a phone's token at once; signing a lost phone
 * out of the account is a separate step under Devices and sessions.
 */
export default function RegisteredPhonesScreen() {
  const { t, i18n } = useTranslation();
  const language = useLanguage();
  const scale = useTextScale();
  const member = useMember();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [done, setDone] = useState<'other' | 'this' | null>(null);

  const phones = useApiQuery<Phones>(async () => {
    const devices = await api().listRegisteredStaffDevices();
    let thisPhoneId = await scannerDeviceId(member.id);
    // A registration withdrawn from another phone, or unknown to the server, can never send scans
    // again: forget it here so the next sync registers this phone afresh.
    if (thisPhoneId !== null && !devices.some((device) => device.id === thisPhoneId && device.revokedAt === null)) {
      await forgetScannerDevice(member.id);
      thisPhoneId = null;
    }
    return { devices, thisPhoneId };
  }, [member.id]);

  const withdraw = useApiAction(async (device: RegisteredStaffDevice, isThisPhone: boolean) => {
    await api().revokeStaffDevice(device.id);
    if (isThisPhone) await forgetScannerDevice(member.id);
    setConfirming(null);
    setDone(isThisPhone ? 'this' : 'other');
    phones.reload();
  });

  const ask = (deviceId: string) => {
    withdraw.clearError();
    setDone(null);
    setConfirming(deviceId);
  };

  return (
    <Screen edges={['bottom']} onRefresh={phones.reload} refreshing={phones.loading && phones.data !== undefined}>
      {/* Tamil first, English under it, whatever the app language (PROJECT.md); each line in its own locked font. */}
      <View accessibilityRole="header" style={styles.heading}>
        <AppText step="section" style={scaledTextStyle('ta', 'section', scale)}>
          {i18n.getFixedT('ta')('s.devices.heading')}
        </AppText>
        <AppText step="secondary" tone="muted" style={scaledTextStyle('en', 'secondary', scale)}>
          {i18n.getFixedT('en')('s.devices.heading')}
        </AppText>
      </View>
      <AppText step="secondary" tone="muted">
        {t('s.devices.hint')}
      </AppText>
      {done ? <Notice tone="success">{t(done === 'this' ? 's.devices.withdrawnThis' : 's.devices.withdrawnOther')}</Notice> : null}
      {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error)}</Notice> : null}
      <QueryView query={phones}>
        {({ devices, thisPhoneId }) => {
          const active = devices.filter((device) => device.revokedAt === null);
          const withdrawn = devices.filter((device) => device.revokedAt !== null);
          if (devices.length === 0) {
            return (
              <AppText step="secondary" tone="muted">
                {t('s.devices.empty')}
              </AppText>
            );
          }
          return (
            <>
              <AppText step="label">{t('s.devices.activeCount', { count: active.length, limit: ACTIVE_LIMIT })}</AppText>
              {active.length >= ACTIVE_LIMIT ? <Notice tone="warning">{t('s.devices.limitReached')}</Notice> : null}
              {[...active, ...withdrawn].map((device) => {
                const isThisPhone = device.id === thisPhoneId;
                const revoked = device.revokedAt !== null;
                return (
                  <SurfaceCard key={device.id}>
                    <View style={styles.row}>
                      <AppText step="card" style={styles.flex}>
                        {device.label}
                      </AppText>
                      {isThisPhone ? <StatusTag tone="verified" label={t('s.devices.thisPhone')} /> : null}
                    </View>
                    <StatusTag
                      tone={revoked ? 'neutral' : 'verified'}
                      label={
                        device.revokedAt === null
                          ? t('s.devices.active')
                          : t('s.devices.withdrawnAt', { time: formatDateTime(device.revokedAt, language) })
                      }
                    />
                    <AppText step="secondary" tone="muted">
                      {t('s.devices.registeredAt', { time: formatDateTime(device.registeredAt, language) })}
                    </AppText>
                    <AppText step="secondary" tone="muted">
                      {device.lastSeenAt
                        ? t('s.devices.lastUsed', { time: formatDateTime(device.lastSeenAt, language) })
                        : t('s.devices.neverUsed')}
                    </AppText>
                    {revoked ? null : confirming === device.id ? (
                      <>
                        <Notice tone="warning" title={t('s.devices.confirmTitle')}>
                          {t(isThisPhone ? 's.devices.confirmThis' : 's.devices.confirmOther')}
                        </Notice>
                        <Button
                          label={t('s.devices.confirmYes')}
                          variant="danger"
                          busy={withdraw.busy}
                          busyLabel={t('s.devices.withdrawing')}
                          onPress={() => void withdraw.run(device, isThisPhone)}
                        />
                        <Button
                          label={t('s.devices.keep')}
                          variant="secondary"
                          disabled={withdraw.busy}
                          onPress={() => setConfirming(null)}
                        />
                      </>
                    ) : (
                      <Button
                        label={t('s.devices.withdraw')}
                        variant="secondary"
                        icon="remove-circle-outline"
                        disabled={withdraw.busy}
                        onPress={() => ask(device.id)}
                      />
                    )}
                  </SurfaceCard>
                );
              })}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
