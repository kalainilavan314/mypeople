import Ionicons from '@expo/vector-icons/Ionicons';
import type { PrivacyRequest } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

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

const DATA_ICONS = ['id-card-outline', 'key-outline', 'shield-checkmark-outline', 'people-outline'] as const;

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
      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.profile.identityData')}
      </AppText>
      <QueryView query={notice}>
        {(items) => (
          <SurfaceCard style={styles.dataCard}>
            {items.map((item, index) => (
              <View key={item.dataEn} style={[styles.item, index > 0 && styles.itemDivider]}>
                <View style={styles.itemIcon}>
                  <Ionicons
                    name={DATA_ICONS[index] ?? 'document-text-outline'}
                    size={20}
                    color={colors.text}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </View>
                <View style={styles.itemCopy}>
                  <AppText step="label">{localized(item.dataEn, item.dataTa)}</AppText>
                  <AppText step="secondary" tone="secondary">
                    {localized(item.purposeEn, item.purposeTa)}
                  </AppText>
                  <AppText step="secondary" tone="muted">
                    {localized(item.retentionEn, item.retentionTa)}
                  </AppText>
                </View>
              </View>
            ))}
          </SurfaceCard>
        )}
      </QueryView>

      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.profile.privacyActions')}
      </AppText>
      <View style={styles.actions}>
        <CopyRequest onSent={requests.reload} />
        <ClosureRequest onSent={requests.reload} />
      </View>

      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.profile.requests')}
      </AppText>
      <QueryView query={requests}>
        {(list) =>
          list.length === 0 ? (
            <SurfaceCard style={styles.emptyState}>
              <View style={styles.itemIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.text} />
              </View>
              <AppText step="secondary" tone="secondary" style={styles.flex}>
                {t('m.common.empty')}
              </AppText>
            </SurfaceCard>
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
    <SurfaceCard style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.itemIcon}>
          <Ionicons
            name={request.kind === 'copy' ? 'download-outline' : 'close-circle-outline'}
            size={20}
            color={colors.text}
          />
        </View>
        <View style={styles.flex}>
          <AppText step="card">{t(`m.profile.kind_${request.kind}`)}</AppText>
          <AppText step="secondary" tone="muted" mono>
            {request.requestRef}
          </AppText>
        </View>
        <StatusTag
          tone={request.state === 'open' ? 'pending' : request.state === 'completed' ? 'verified' : 'error'}
          label={t(`m.profile.requestState_${request.state}`)}
        />
      </View>
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
      <Button label={t('m.profile.requestCopy')} variant="danger" icon="download-outline" busy={send.busy} onPress={() => void send.run()} />
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
    return <Button label={t('m.profile.requestClosure')} variant="primary" icon="close-circle-outline" onPress={() => setOpen(true)} />;
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
  sectionTitle: { marginTop: spacing[2] },
  dataCard: { padding: 0, gap: 0, overflow: 'hidden' },
  item: {
    position: 'relative',
    minHeight: 112,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    overflow: 'hidden',
  },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: { flex: 1, gap: 1, paddingRight: spacing[3] },
  actions: { gap: spacing[3] },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  requestCard: { gap: spacing[3] },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
