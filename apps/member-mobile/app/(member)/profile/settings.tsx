import type { NotificationChoices } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  ChipRow,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { chooseLanguage, type AppLanguage } from '@/lib/i18n';

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
  const choices = useApiQuery(() => api().getNotificationChoices());
  return (
    <Screen edges={['bottom']}>
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.language')}
      </AppText>
      <ChipRow<AppLanguage>
        label={t('m.profile.language')}
        selected={language}
        onSelect={(next) => void chooseLanguage(next)}
        options={[
          { key: 'ta', label: 'தமிழ்' },
          { key: 'en', label: 'English' },
        ]}
      />
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.channelsTitle')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.profile.channelsHint')}
      </AppText>
      <QueryView query={choices}>{(data) => <ChoicesForm initial={data} />}</QueryView>
      <ChannelsCard />
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
      <SurfaceCard>
        {topics.map((item) => (
          <View key={item.topic} style={styles.topic}>
            <View style={styles.topicLabel}>
              <AppText step="label">{t(`m.profile.topic_${item.topic}`)}</AppText>
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
                  trackColor={{ true: colors.primary, false: colors.inputBorder }}
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
  topic: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.divider },
  topicLabel: { flex: 1 },
  channel: { alignItems: 'center', gap: 2 },
  quiet: { flexDirection: 'row', gap: spacing[3] },
  flex: { flex: 1 },
});
