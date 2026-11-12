import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  formatDateTime,
  formatTime,
  Notice,
  QrCode,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useRotatingCode,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * E06: the event pass. Its QR is a 60-second code bound to this event and this
 * member (BR-060), renewed before it runs out; it carries no personal data.
 */
export default function EventPassScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pass = useApiQuery(() => api().getEventPass(id), [id]);
  const code = useRotatingCode(() => api().getEventPassCode(id), pass.data !== undefined && !pass.data.attendedAt, [id]);

  return (
    <Screen edges={['bottom']} maxContentWidth={640}>
      <QueryView query={pass}>
        {(data) => (
          <>
            <AppText step="page" accessibilityRole="header">
              {localized(data.titleEn, data.titleTa)}
            </AppText>
            <AppText step="secondary" tone="muted">
              {`${formatDateTime(data.startsAt, language)} · ${data.venue}`}
            </AppText>
            {data.attendedAt ? (
              <StatusTag tone="verified" label={t('m.events.attended', { time: formatDateTime(data.attendedAt, language) })} />
            ) : (
              <SurfaceCard>
                <View style={styles.qr}>
                  {code.data ? (
                    <QrCode value={code.data.code} size={240} label={t('m.events.passTitle')} />
                  ) : (
                    <AppText step="secondary" tone="muted">
                      {t('m.events.passRefreshing')}
                    </AppText>
                  )}
                </View>
                <AppText step="secondary" tone="secondary" style={styles.center}>
                  {t('m.events.passHint')}
                </AppText>
                <AppText step="secondary" tone="muted" style={styles.center}>
                  {t('m.events.checkinWindow', {
                    from: formatTime(data.checkinOpensAt, language),
                    to: formatTime(data.checkinClosesAt, language),
                  })}
                </AppText>
                {code.error ? <Notice tone="error">{errorMessage(t, code.error)}</Notice> : null}
              </SurfaceCard>
            )}
            {data.meetingPoint ? (
              <AppText step="secondary" tone="secondary">{`${t('m.events.meetingPoint')}: ${data.meetingPoint}`}</AppText>
            ) : null}
            {localized(data.instructionsEn ?? '', data.instructionsTa ?? '') ? (
              <AppText step="secondary" tone="muted">
                {localized(data.instructionsEn ?? '', data.instructionsTa ?? '')}
              </AppText>
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 256,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing[2],
  },
  center: { textAlign: 'center' },
});
