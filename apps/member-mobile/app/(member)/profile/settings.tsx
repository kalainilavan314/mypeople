import Ionicons from '@expo/vector-icons/Ionicons';
import type { EffectiveGovernancePolicy, NotificationChoices } from '@my-people/api-client';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  MenuRow,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  ToggleSwitch,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { chooseLanguage, type AppLanguage } from '@/lib/i18n';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type IconName = ComponentProps<typeof Ionicons>['name'];

const TOPIC_ICONS: Record<string, IconName> = {
  account: 'notifications-outline',
  review: 'id-card-outline',
  events: 'calendar-outline',
  announcements: 'megaphone-outline',
  emergency: 'warning-outline',
};

/** P04 and P05: the app's language, and push and SMS per topic with quiet hours (FR-PROF-012, FR-STF-009). */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const choices = useApiQuery(() => api().getNotificationChoices());
  const policies = useApiQuery(() => api().listMyGovernancePolicies(), [language]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <AppText
        step="section"
        accessibilityRole="header"
        style={styles.sectionTitle}>
        {t('m.profile.language')}
      </AppText>
      <LanguagePicker selected={language} onSelect={(next) => void chooseLanguage(next)} />
      <AppText
        step="section"
        accessibilityRole="header"
        style={styles.sectionTitle}>
        {t('m.profile.notifications')}
      </AppText>
      <QueryView query={choices}>{(data) => <ChoicesForm initial={data} />}</QueryView>
      <ChannelsCard />
      <AppText
        step="section"
        accessibilityRole="header"
        style={styles.sectionTitle}>
        {t('m.profile.policies')}
      </AppText>
      <QueryView query={policies}>{(data) => <PolicyChoices items={data} reload={policies.reload} />}</QueryView>
      {/* M44: text size and data saver. Privacy, security and signing out are on Profile. */}
      <SurfaceCard>
        <MenuRow first icon="text-outline" label={t('m.accessibility.title')} onPress={() => router.push('/profile/accessibility')} />
      </SurfaceCard>
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

function LanguagePicker({ selected, onSelect }: { selected: AppLanguage; onSelect: (language: AppLanguage) => void }) {
  const { t } = useTranslation();
  const options: { key: AppLanguage; label: string }[] = [
    { key: 'ta', label: 'தமிழ்' },
    { key: 'en', label: 'English' },
  ];

  return (
    <View style={styles.languagePicker} accessibilityRole="radiogroup" accessibilityLabel={t('m.profile.language')}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="radio"
            aria-checked={active}
            style={({ pressed }) => [
              styles.languageOption,
              active ? styles.languageActive : styles.languageInactive,
              pressed && styles.pressed,
            ]}>
            <AppText step="label" tone={active ? 'selected' : 'default'} style={styles.languageLabel}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
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
  if (items.length === 0) return null;
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
    {action.error ? <Notice tone="error">{t('m.errors.unknown')}</Notice> : null}
  </>;
}

function ChoicesForm({ initial }: { initial: NotificationChoices }) {
  const { t } = useTranslation();
  const [topics, setTopics] = useState(initial.topics);
  const [quietStart, setQuietStart] = useState(initial.quietStart?.slice(0, 5) ?? '');
  const [quietEnd, setQuietEnd] = useState(initial.quietEnd?.slice(0, 5) ?? '');
  const [saved, setSaved] = useState(false);
  const { stackControls } = useResponsiveLayout();
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
      <SurfaceCard style={styles.topicList}>
        {!stackControls ? (
          <View style={styles.topicHeader}>
            <View style={styles.topicHeaderSpacer} />
            <AppText step="caption" tone="muted" style={styles.channelHeader}>
              {t('m.profile.pushLabel')}
            </AppText>
            <AppText step="caption" tone="muted" style={styles.channelHeader}>
              {t('m.profile.smsLabel')}
            </AppText>
          </View>
        ) : null}
        {topics.map((item, index) => (
          <View
            key={item.topic}
            style={[styles.topic, stackControls && styles.stackedTopic, index > 0 && styles.topicDivider]}>
            <View style={[styles.topicIdentity, stackControls && styles.stackedTopicIdentity]}>
              <View style={styles.topicIcon}>
                <Ionicons
                  name={TOPIC_ICONS[item.topic] ?? 'notifications-outline'}
                  size={20}
                  color={colors.text}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
              <View style={styles.topicLabel}>
                <AppText step="card">
                  {t(`m.profile.topic_${item.topic}`)}
                </AppText>
                {item.locked ? (
                  <AppText step="secondary" tone="muted">
                    {t('m.profile.lockedTopic')}
                  </AppText>
                ) : null}
              </View>
            </View>
            <View style={[styles.channels, stackControls && styles.stackedChannels]}>
              {(['push', 'sms'] as const).map((channel) => (
                <View key={channel} style={[styles.channel, stackControls && styles.stackedChannel]}>
                  {stackControls ? (
                    <AppText step="caption" tone="muted" style={styles.stackedChannelLabel}>
                      {channel === 'push' ? t('m.profile.pushLabel') : t('m.profile.smsLabel')}
                    </AppText>
                  ) : null}
                  <ToggleSwitch
                    value={item[channel]}
                    disabled={item.locked}
                    onValueChange={(value) => toggle(item.topic, channel, value)}
                    accessibilityLabel={`${t(`m.profile.topic_${item.topic}`)}: ${channel === 'push' ? t('m.profile.pushLabel') : t('m.profile.smsLabel')}`}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </SurfaceCard>
      <SurfaceCard style={styles.quietCard}>
        <View style={styles.quietHeader}>
          <View style={styles.topicIcon}>
            <Ionicons
              name="moon-outline"
              size={20}
              color={colors.text}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
          <View style={styles.flex}>
            <AppText step="card">{t('m.profile.quietHours')}</AppText>
            <AppText step="secondary" tone="secondary">
              {t('m.profile.quietHoursHint')}
            </AppText>
          </View>
        </View>
        <View style={[styles.quiet, stackControls && styles.stackedQuiet]}>
          <View style={styles.flex}>
            <TextField label={t('m.profile.quietFrom')} value={quietStart} onChangeText={setQuietStart} placeholder="22:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.flex}>
            <TextField label={t('m.profile.quietTo')} value={quietEnd} onChangeText={setQuietEnd} placeholder="06:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
        </View>
        <Pressable
          onPress={() => {
            setQuietStart('');
            setQuietEnd('');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('m.profile.clearQuiet')}
          style={({ pressed }) => [styles.clearQuiet, pressed && styles.pressed]}>
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
          <AppText step="label" tone="primary">
            {t('m.profile.clearQuiet')}
          </AppText>
        </Pressable>
      </SurfaceCard>
      {quietInvalid ? <Notice tone="error">{t('m.profile.quietHoursInvalid')}</Notice> : null}
      {save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}
      {saved ? <Notice tone="success">{t('m.profile.saved')}</Notice> : null}
      <Button label={t('m.common.save')} busy={save.busy} busyLabel={t('m.common.saving')} disabled={quietInvalid} onPress={() => void save.run()} />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing[2] },
  languagePicker: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageOption: {
    flex: 1,
    minHeight: control.height,
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageInactive: {
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  languageActive: {
    marginLeft: -1,
    borderColor: colors.selected,
    backgroundColor: colors.selected,
    borderRadius: radius.pill,
  },
  languageLabel: { textAlign: 'center' },
  topicList: { padding: 0, gap: 0, overflow: 'hidden' },
  version: { textAlign: 'center' },
  topicHeader: {
    minHeight: 42,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicHeaderSpacer: { flex: 1 },
  channelHeader: { width: 62, textAlign: 'center' },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 78,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  stackedTopic: { alignItems: 'stretch', flexDirection: 'column', gap: spacing[3], paddingVertical: spacing[3] },
  topicDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  topicIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stackedTopicIdentity: { width: '100%' },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicLabel: { flex: 1, gap: 1 },
  channels: { flexDirection: 'row' },
  stackedChannels: { width: '100%', gap: spacing[4], paddingLeft: 52 },
  channel: { width: 62, alignItems: 'center', justifyContent: 'center' },
  stackedChannel: { width: 'auto', minWidth: 72, alignItems: 'flex-start', gap: spacing[1] },
  stackedChannelLabel: { textAlign: 'left' },
  quietCard: { gap: spacing[4] },
  quietHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  quiet: { flexDirection: 'row', gap: spacing[3] },
  stackedQuiet: { flexDirection: 'column' },
  clearQuiet: {
    minHeight: control.touchMin,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.78 },
});
