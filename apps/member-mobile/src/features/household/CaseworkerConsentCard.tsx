import type { Household } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDate,
  Notice,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Household rule "visible, with recorded consent, to a caseworker" (OD-30: consent per purpose).
 * The head allows it; any confirmed adult can withdraw it. Every caseworker opening is in the history.
 */
export function CaseworkerConsentCard({ household, onChanged }: { household: Household; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const allowed = Boolean(household.caseworkerConsentAt);

  const give = useApiAction(async () => {
    await api().giveCaseworkerConsent();
    onChanged();
  });
  const withdraw = useApiAction(async () => {
    await api().withdrawCaseworkerConsent();
    onChanged();
  });

  const confirmGive = async () => {
    const confirmed = await confirmAction({
      title: t('m.household.caseworkerGive'),
      message: t('m.household.caseworkerGiveConfirm'),
      confirmLabel: t('m.household.caseworkerGive'),
      cancelLabel: t('m.common.cancel'),
    });
    if (confirmed) void give.run();
  };
  const confirmWithdraw = async () => {
    const confirmed = await confirmAction({
      title: t('m.household.caseworkerWithdraw'),
      message: t('m.household.caseworkerWithdrawConfirm'),
      confirmLabel: t('m.household.caseworkerWithdraw'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) void withdraw.run();
  };

  const failure = give.error ?? withdraw.error;
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{t('m.household.caseworkerTitle')}</AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.household.caseworkerIntro')}
      </AppText>
      <View style={styles.status}>
        <StatusTag
          tone={allowed ? 'verified' : 'neutral'}
          label={
            allowed && household.caseworkerConsentAt
              ? t('m.household.caseworkerOn', { date: formatDate(household.caseworkerConsentAt, language) })
              : t('m.household.caseworkerOff')
          }
        />
      </View>
      <AppText step="secondary" tone="muted">
        {t('m.household.caseworkerRule')}
      </AppText>
      {failure ? <Notice tone="error">{errorMessage(t, failure)}</Notice> : null}
      {allowed ? (
        <Button
          label={t('m.household.caseworkerWithdraw')}
          variant="danger"
          busy={withdraw.busy}
          onPress={() => void confirmWithdraw()}
        />
      ) : household.isHead ? (
        <Button label={t('m.household.caseworkerGive')} busy={give.busy} onPress={() => void confirmGive()} />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  status: { flexDirection: 'row', marginTop: spacing[1] },
});
