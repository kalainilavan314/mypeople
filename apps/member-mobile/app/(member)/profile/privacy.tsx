import type { PrivacyRequest } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  formatDate,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * P06: the identity data we keep and why (FR-PROF-010), and data-subject
 * requests with receipts: a copy of one's data, or closing the account with
 * the password and a code, reviewed by the DPO and never deleted at once.
 */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const notice = useApiQuery(() => api().getIdentityDataNotice());
  const requests = useApiQuery(() => api().listMyPrivacyRequests());

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={requests.reload}
      refreshing={requests.loading && requests.data !== undefined}>
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.identityData')}
      </AppText>
      <QueryView query={notice}>
        {(items) => (
          <SurfaceCard>
            {items.map((item, index) => (
              <View key={item.dataEn} style={[styles.item, index > 0 && styles.itemDivider]}>
                <AppText step="label">{localized(item.dataEn, item.dataTa)}</AppText>
                <AppText step="secondary" tone="secondary">
                  {localized(item.purposeEn, item.purposeTa)}
                </AppText>
                <AppText step="secondary" tone="muted">
                  {localized(item.retentionEn, item.retentionTa)}
                </AppText>
              </View>
            ))}
          </SurfaceCard>
        )}
      </QueryView>

      <AppText step="section" accessibilityRole="header">
        {t('m.profile.privacyActions')}
      </AppText>
      <View style={styles.actions}>
        <CopyRequest onSent={requests.reload} />
        <ClosureRequest onSent={requests.reload} />
      </View>

      <AppText step="section" accessibilityRole="header">
        {t('m.profile.requests')}
      </AppText>
      <QueryView query={requests}>
        {(list) =>
          list.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.common.empty')}
            </AppText>
          ) : (
            list.map((request) => <RequestCard key={request.id} request={request} />)
          )
        }
      </QueryView>
    </Screen>
  );
}

function RequestCard({ request }: { request: PrivacyRequest }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard>
      <AppText step="card">{t(`m.profile.kind_${request.kind}`)}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {request.requestRef}
      </AppText>
      <StatusTag
        tone={request.state === 'open' ? 'pending' : request.state === 'completed' ? 'verified' : 'error'}
        label={t(`m.profile.requestState_${request.state}`)}
      />
      <AppText step="secondary" tone="secondary">{`${formatDate(request.createdAt, language)} → ${formatDate(request.dueAt, language)}`}</AppText>
      {request.outcomeNote ? (
        <AppText step="secondary" tone="secondary">
          {request.outcomeNote}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

function CopyRequest({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [receipt, setReceipt] = useState<PrivacyRequest | null>(null);
  const send = useApiAction(async () => {
    setReceipt(await api().makePrivacyRequest({ kind: 'copy', note: '' }));
    onSent();
  });
  return (
    <>
      <Button label={t('m.profile.requestCopy')} variant="secondary" icon="download-outline" busy={send.busy} onPress={() => void send.run()} />
      {receipt ? <Notice tone="success">{t('m.profile.requestSent', { ref: receipt.requestRef, due: formatDate(receipt.dueAt, language) })}</Notice> : null}
      {send.error ? <Notice tone="error">{errorMessage(t, send.error)}</Notice> : null}
    </>
  );
}

function ClosureRequest({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PrivacyRequest | null>(null);
  const sendCode = useApiAction(async () => {
    const result = await api().sendClosureCode();
    setDevCode(result.devCode ?? null);
  });
  const send = useApiAction(async () => {
    setReceipt(await api().makePrivacyRequest({ kind: 'closure', note: '', password, code: code.trim() }));
    setPassword('');
    setCode('');
    onSent();
  });

  if (receipt) {
    return <Notice tone="success">{t('m.profile.requestSent', { ref: receipt.requestRef, due: formatDate(receipt.dueAt, language) })}</Notice>;
  }
  if (!open) {
    return <Button label={t('m.profile.requestClosure')} variant="danger" icon="close-circle-outline" onPress={() => setOpen(true)} />;
  }
  const failed = sendCode.error ?? send.error;
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.requestClosure')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.profile.closureHint')}
      </AppText>
      <Button label={t('m.profile.sendCode')} variant="secondary" busy={sendCode.busy} onPress={() => void sendCode.run()} />
      {devCode ? <Notice tone="info">{t('m.profile.devCode', { code: devCode })}</Notice> : null}
      <TextField label={t('m.profile.closureCode')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <TextField label={t('m.profile.currentPassword')} value={password} onChangeText={setPassword} secret autoComplete="current-password" />
      {failed ? <Notice tone="error">{errorMessage(t, failed)}</Notice> : null}
      <Button
        label={t('m.profile.requestClosure')}
        variant="danger"
        busy={send.busy}
        busyLabel={t('m.common.sending')}
        disabled={password === '' || code.trim().length < 4}
        onPress={() => void send.run()}
      />
      <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setOpen(false)} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  item: { gap: 2, paddingVertical: spacing[2] },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  actions: { gap: spacing[3] },
});
