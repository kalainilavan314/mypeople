import type { EffectiveGovernancePolicy, NotificationChoices } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import Constants from 'expo-constants';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  LanguageToggle,
  MenuRow,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useSession,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { chooseLanguage } from '@/lib/i18n';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * P04 and P05 with M45 (SMS part): the app's language, and how each kind of
 * message reaches the member — push and SMS per topic, quiet hours, and the
 * confirmed number texts go to (FR-PROF-012, FR-STF-009, FR-MSG-002, 004).
 * The API saves the SMS choices, but nothing is texted until an SMS vendor
 * is contracted (INT-01), so the screen says so rather than imply delivery.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { signOut } = useSession();
  const choices = useApiQuery(() => api().getNotificationChoices());
  const policies = useApiQuery(() => api().listMyGovernancePolicies(), [language]);
  return (
    <Screen edges={['bottom']}>
      <SurfaceCard style={styles.group}>
        <MenuRow
          first
          icon="language-outline"
          label={t('m.profile.language')}
          trailing={<LanguageToggle value={language} onChange={(next) => void chooseLanguage(next)} label={t('m.profile.language')} />}
        />
      </SurfaceCard>
      <AppText step="body" tone="muted" accessibilityRole="header">
        {t('m.profile.channelsTitle')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.profile.channelsHint')}
      </AppText>
      <QueryView query={choices}>{(data) => <ChoicesForm initial={data} />}</QueryView>
      <ChannelsCard />
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.policies')}
      </AppText>
      <QueryView query={policies}>{(data) => <PolicyChoices items={data} reload={policies.reload} />}</QueryView>
      <SurfaceCard style={styles.group}>
        <MenuRow first icon="lock-closed-outline" label={t('m.profile.privacyConsent')} onPress={() => router.push('/profile/privacy')} />
        <MenuRow icon="key-outline" label={t('m.profile.passwordRecovery')} onPress={() => router.push('/profile/security')} />
        <MenuRow icon="text-outline" label={t('m.accessibility.title')} onPress={() => router.push('/profile/accessibility')} />
      </SurfaceCard>
      <Button label={t('m.common.signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
      <AppText step="caption" tone="muted" style={styles.version}>
        {t('m.profile.versionLine', { version: Constants.expoConfig?.version ?? '' })}
      </AppText>
    </Screen>
  );
}

/** M45: where texts go, how to change that number (confirmed with a code), and what is not connected yet. */
function ChannelsCard() {
  const { t } = useTranslation();
  const phone = useApiQuery(() => api().getMyRecoveryPhone());
  let number: string;
  if (phone.data) number = phone.data.phone;
  else if (phone.data === null) number = t('m.profile.smsNoNumber');
  else number = phone.loading ? t('m.common.loading') : t('m.common.loadFailed');
  return (
    <SurfaceCard>
      <AppText step="label">{t('m.profile.smsNumber')}</AppText>
      <AppText step="body" mono={Boolean(phone.data)} tone={phone.data ? 'default' : 'muted'}>
        {number}
      </AppText>
      <Button
        label={phone.data ? t('m.profile.changeNumber') : t('m.profile.addNumber')}
        variant="secondary"
        icon="call-outline"
        onPress={() => router.push('/profile/recovery-number')}
      />
      <Notice tone="info">{t('m.profile.smsNotConnected')}</Notice>
      <AppText step="caption" tone="muted">
        {t('m.profile.whatsappLater')}
      </AppText>
    </SurfaceCard>
  );
}

function PolicyChoices({ items, reload }: { items: EffectiveGovernancePolicy[]; reload: () => void }) {
  const { t } = useTranslation();
  const action = useApiAction(async (policy: EffectiveGovernancePolicy, next: 'acknowledged' | 'granted' | 'withdrawn') => {
    await api().recordGovernanceConsent(policy.id, {
      action: next,
      legalBasis: policy.policyType === 'optional_consent' ? 'consent' : 'legal_notice_acknowledgement',
    });
    reload();
  });
  if (items.length === 0) return <AppText step="secondary" tone="muted">{t('m.profile.noPolicies')}</AppText>;
  return <>
    {items.map((policy) => {
      const optional = policy.policyType === 'optional_consent';
      const active = optional ? policy.myAction === 'granted' : policy.myAction === 'acknowledged';
      return <SurfaceCard key={policy.id}>
        <AppText step="section">{policy.policyKey}</AppText>
        <AppText step="caption" tone="muted">{t('m.profile.policyVersion', { version: policy.version })}</AppText>
        <AppText step="body" tone="secondary">{policy.contentText}</AppText>
        <Notice tone={active ? 'success' : 'warning'}>
          {active ? t('m.profile.policyCurrent') : t('m.profile.policyActionNeeded')}
        </Notice>
        {optional ? <Button
          label={active ? t('m.profile.withdrawConsent') : t('m.profile.giveConsent')}
          variant={active ? 'secondary' : 'primary'}
          busy={action.busy}
          onPress={() => void action.run(policy, active ? 'withdrawn' : 'granted')}
        /> : !active ? <Button
          label={t('m.profile.acknowledgePolicy')}
          busy={action.busy}
          onPress={() => void action.run(policy, 'acknowledged')}
        /> : null}
      </SurfaceCard>;
    })}
    {action.error ? <Notice tone="error">{errorMessage(t, action.error)}</Notice> : null}
  </>;
}

function ChoicesForm({ initial }: { initial: NotificationChoices }) {
  const { t } = useTranslation();
  const [topics, setTopics] = useState(initial.topics);
  const [quietStart, setQuietStart] = useState(initial.quietStart?.slice(0, 5) ?? '');
  const [quietEnd, setQuietEnd] = useState(initial.quietEnd?.slice(0, 5) ?? '');
  const [saved, setSaved] = useState(false);
  const save = useApiAction(async () => {
    setSaved(false);
    const quiet = quietStart && quietEnd;
    const result = await api().updateNotificationChoices({
      topics: topics.filter((topic) => !topic.locked).map(({ topic, push, sms }) => ({ topic, push, sms })),
      quietStart: quiet ? quietStart : null,
      quietEnd: quiet ? quietEnd : null,
      clearQuietHours: !quiet,
    });
    setTopics(result.topics);
    setSaved(true);
  });
  const quietInvalid = (quietStart === '') !== (quietEnd === '') ||
    (quietStart !== '' && !TIME.test(quietStart)) || (quietEnd !== '' && !TIME.test(quietEnd));

  const toggle = (topic: string, channel: 'push' | 'sms', value: boolean) =>
    setTopics(topics.map((item) => (item.topic === topic ? { ...item, [channel]: value } : item)));

  return (
    <>
      <SurfaceCard style={styles.group}>
        {topics.map((item, index) => (
          <View key={item.topic} style={[styles.topic, index > 0 && styles.topicRule]}>
            <View style={styles.topicLabel}>
              <AppText step="card" weight={400}>{t(`m.profile.topic_${item.topic}`)}</AppText>
              {item.locked ? (
                <AppText step="caption" tone="muted">
                  {t('m.profile.lockedTopic')}
                </AppText>
              ) : null}
            </View>
            {(['push', 'sms'] as const).map((channel) => (
              <View key={channel} style={styles.channel}>
                <AppText step="caption" tone="muted">
                  {channel === 'push' ? t('m.profile.pushLabel') : t('m.profile.smsLabel')}
                </AppText>
                <Switch
                  value={item[channel]}
                  disabled={item.locked}
                  onValueChange={(value) => toggle(item.topic, channel, value)}
                  accessibilityLabel={`${t(`m.profile.topic_${item.topic}`)}: ${channel === 'push' ? t('m.profile.pushLabel') : t('m.profile.smsLabel')}`}
                  trackColor={{ true: colors.switchOn, false: colors.inputBorder }}
                  thumbColor={colors.card}
                />
              </View>
            ))}
          </View>
        ))}
      </SurfaceCard>
      <SurfaceCard>
        <AppText step="label">{t('m.profile.quietHours')}</AppText>
        <AppText step="secondary" tone="muted">
          {t('m.profile.quietHoursHint')}
        </AppText>
        <View style={styles.quiet}>
          <View style={styles.flex}>
            <TextField label={t('m.profile.quietFrom')} value={quietStart} onChangeText={setQuietStart} placeholder="22:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.flex}>
            <TextField label={t('m.profile.quietTo')} value={quietEnd} onChangeText={setQuietEnd} placeholder="06:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
        </View>
        <Button
          label={t('m.profile.clearQuiet')}
          variant="quiet"
          onPress={() => {
            setQuietStart('');
            setQuietEnd('');
          }}
        />
      </SurfaceCard>
      {quietInvalid ? <Notice tone="error">{t('m.profile.quietHoursInvalid')}</Notice> : null}
      {save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}
      {saved ? <Notice tone="success">{t('m.profile.saved')}</Notice> : null}
      <Button label={t('m.common.save')} busy={save.busy} busyLabel={t('m.common.saving')} disabled={quietInvalid} onPress={() => void save.run()} />
    </>
  );
}

const styles = StyleSheet.create({
  group: { paddingVertical: spacing[1] },
  version: { textAlign: 'center' },
  topic: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 56, paddingVertical: spacing[2] },
  topicRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  topicLabel: { flex: 1 },
  channel: { alignItems: 'center', gap: 2 },
  quiet: { flexDirection: 'row', gap: spacing[3] },
  flex: { flex: 1 },
});
