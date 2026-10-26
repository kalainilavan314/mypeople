import type { NotificationChoices } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChipRow } from '@/components/ChipRow';
import { Notice } from '@/components/Notice';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TextField } from '@/components/TextField';
import { useApiAction, useApiQuery } from '@/hooks/useApi';
import { useLanguage } from '@/hooks/useLanguage';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { chooseLanguage, type AppLanguage } from '@/lib/i18n';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** P04 and P05: the app's language, and push and SMS per topic with quiet hours (FR-PROF-012, FR-STF-009). */
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
        {t('m.profile.notifications')}
      </AppText>
      <QueryView query={choices}>{(data) => <ChoicesForm initial={data} />}</QueryView>
    </Screen>
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
  const quietInvalid = (quietStart !== '' && !TIME.test(quietStart)) || (quietEnd !== '' && !TIME.test(quietEnd));

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
      {quietInvalid ? <Notice tone="error">{t('m.profile.quietHoursHint')}</Notice> : null}
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
