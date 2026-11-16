import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Notice,
  Screen,
  SegmentedControl,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  type AppLanguage,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { copyText, shareText, type ShareOutcome } from '@/features/referrals/copyOrShare';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * H19 Invite a member: the member's referral code to copy in one tap, and an invitation in Tamil or
 * English to preview in full and then share through the phone's share sheet (FR-REF-001 to 004).
 * The preview makes nothing: the invitation and its opaque link are made only as the member shares,
 * so My invitations never lists one that was only previewed (H20). The app never asks for contacts.
 */
export default function InviteScreen() {
  const referrals = useApiQuery(() => api().getMyReferrals());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="referrals" query={referrals}>
        {(data) => <InviteBody code={data.referralCode} onShared={referrals.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

type Shared = { outcome: ShareOutcome; number: number };

function InviteBody({ code, onShared }: { code: string; onShared: () => void }) {
  const { t } = useTranslation();
  const appLanguage = useLanguage();
  const [language, setLanguage] = useState<AppLanguage>(appLanguage);
  const [preview, setPreview] = useState<string | null>(null);
  const [shared, setShared] = useState<Shared | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  const showPreview = useApiAction(async () => {
    setPreview((await api().previewInvitation(language)).preview);
  });
  const share = useApiAction(async () => {
    setShared(null);
    const made = await api().createInvitation(language);
    const outcome = await shareText(made.preview);
    if (outcome === 'dismissed') {
      try {
        await api().cancelInvitation(made.number);
      } catch {
        // Not taken back (no connection): it stays listed as Shared, which is the safe side.
      }
    }
    setShared({ outcome, number: made.number });
    onShared();
  });
  const error = showPreview.error ?? share.error;
  const number = (n: number) => String(n).padStart(2, '0');

  return (
    <View style={styles.body}>
      <SurfaceCard style={styles.card}>
        <AppText step="label">{t('m.referrals.yourCode')}</AppText>
        <AppText step="page" mono selectable>
          {code}
        </AppText>
        <AppText step="secondary" tone="muted">
          {t('m.referrals.codeHint')}
        </AppText>
        <Button
          label={t('m.referrals.copyCode')}
          variant="secondary"
          icon="copy-outline"
          onPress={() => void copyText(code).then(setCopied)}
        />
        {copied !== null ? (
          <AppText step="secondary" tone={copied ? 'success' : 'error'} accessibilityLiveRegion="polite">
            {copied ? t('m.referrals.copied') : t('m.referrals.copyFailed')}
          </AppText>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.referrals.invitation')}
        </AppText>
        <AppText step="body" tone="secondary">
          {t('m.referrals.languageHint')}
        </AppText>
        <SegmentedControl
          label={t('m.referrals.language')}
          selected={language}
          onSelect={(next) => {
            if (next === language) return;
            setLanguage(next);
            setPreview(null);
            setShared(null);
            showPreview.clearError();
            share.clearError();
          }}
          options={[
            { key: 'ta', label: 'தமிழ்' },
            { key: 'en', label: 'English' },
          ]}
        />
        {preview ? (
          <View style={styles.preview} accessible accessibilityLabel={`${t('m.referrals.preview')}. ${preview}`}>
            <AppText step="caption" tone="primary">
              {t('m.referrals.preview')}
            </AppText>
            <AppText step="body" selectable>
              {preview}
            </AppText>
            <AppText step="secondary" tone="muted">
              {t('m.referrals.previewLinkNote')}
            </AppText>
          </View>
        ) : (
          <Button
            label={t('m.referrals.previewInvitation')}
            variant="secondary"
            icon="eye-outline"
            busy={showPreview.busy}
            onPress={() => void showPreview.run()}
          />
        )}
        {error ? <Notice tone="error">{errorMessage(t, error, 'referrals')}</Notice> : null}
        <Button label={t('m.referrals.shareInvitation')} icon="share-social-outline" busy={share.busy} onPress={() => void share.run()} />
        {shared ? (
          <Notice tone={shared.outcome === 'dismissed' ? 'info' : 'success'}>
            {shared.outcome === 'shared'
              ? t('m.referrals.sharedNumber', { number: number(shared.number) })
              : shared.outcome === 'copied'
                ? t('m.referrals.copiedInvitation', { number: number(shared.number) })
                : t('m.referrals.notShared')}
          </Notice>
        ) : null}
        <AppText step="secondary" tone="muted">
          {t('m.referrals.privacyNote')}
        </AppText>
      </SurfaceCard>

      <Notice tone="info">{t('m.referrals.noRewards')}</Notice>
      <Button label={t('m.referrals.myInvitations')} variant="quiet" icon="list-outline" onPress={() => router.push('/referrals')} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
  preview: { gap: spacing[1] },
});
