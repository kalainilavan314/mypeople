import type { NewInvitation } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
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
import { copiesDirectly, copyOrShare } from '@/features/referrals/copyOrShare';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * H19 Invite a member: the member's referral code to copy, and an invitation in Tamil or English
 * to preview in full and share through the phone's share sheet (FR-REF-001 to 004). The link
 * carries only an opaque token; the app never asks for the contacts list.
 */
export default function InviteScreen() {
  const referrals = useApiQuery(() => api().getMyReferrals());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="referrals" query={referrals}>
        {(data) => <InviteBody code={data.referralCode} onCreated={referrals.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function InviteBody({ code, onCreated }: { code: string; onCreated: () => void }) {
  const { t } = useTranslation();
  const appLanguage = useLanguage();
  const [language, setLanguage] = useState<AppLanguage>(appLanguage);
  const [invitation, setInvitation] = useState<NewInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  // One invitation per language chosen: previewing and then sharing use the same link.
  const prepare = useApiAction(async () => {
    const made = invitation ?? (await api().createInvitation(language));
    if (!invitation) {
      setInvitation(made);
      onCreated();
    }
    return made;
  });
  const share = async () => {
    const made = await prepare.run();
    if (!made) return;
    try {
      await Share.share({ message: made.preview });
    } catch {
      // Closed or not available: nothing was shared.
    }
  };
  const copy = async () => setCopied(await copyOrShare(code));

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
          label={copiesDirectly ? t('m.referrals.copyCode') : t('m.referrals.shareCode')}
          variant="secondary"
          icon={copiesDirectly ? 'copy-outline' : 'share-outline'}
          onPress={() => void copy()}
        />
        {copied ? (
          <AppText step="secondary" tone="success" accessibilityLiveRegion="polite">
            {t('m.referrals.copied')}
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
            setInvitation(null);
            prepare.clearError();
          }}
          options={[
            { key: 'ta', label: 'தமிழ்' },
            { key: 'en', label: 'English' },
          ]}
        />
        {invitation ? (
          <View style={styles.preview} accessible accessibilityLabel={`${t('m.referrals.preview')}. ${invitation.preview}`}>
            <AppText step="caption" tone="primary">
              {t('m.referrals.previewNumber', { number: String(invitation.number).padStart(2, '0') })}
            </AppText>
            <AppText step="body" selectable>
              {invitation.preview}
            </AppText>
          </View>
        ) : null}
        {prepare.error ? <Notice tone="error">{errorMessage(t, prepare.error, 'referrals')}</Notice> : null}
        {invitation ? null : (
          <Button
            label={t('m.referrals.previewInvitation')}
            variant="secondary"
            icon="eye-outline"
            busy={prepare.busy}
            onPress={() => void prepare.run()}
          />
        )}
        <Button label={t('m.referrals.shareInvitation')} icon="share-social-outline" busy={prepare.busy && invitation !== null} onPress={() => void share()} />
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
