import type { CommitteeItem } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, formatDateTime, StatusTag, SurfaceCard, useLanguage } from '@my-people/mobile-ui';

import { Collapsible } from '@/components/Collapsible';

import { deviceTime, meetingsWithMinutes } from './labels';

/** Announcements for this committee only (FR-COM-004), newest first. */
export function Announcements({ items }: { items: CommitteeItem[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const news = items.filter((item) => item.itemType === 'announcement');
  if (news.length === 0) return <Empty text={t('m.committees.noNews')} />;
  return (
    <View style={styles.list}>
      {news.map((item) => (
        <SurfaceCard key={item.id} style={styles.card}>
          <AppText step="card">{item.title}</AppText>
          <AppText step="caption" tone="muted">
            {t('m.committees.byOn', { name: item.authorName, date: formatDate(item.createdAt, language) })}
          </AppText>
          <AppText step="body">{item.body}</AppText>
        </SurfaceCard>
      ))}
    </View>
  );
}

/**
 * Meetings with their approved minutes (FR-COM-005: members never see minutes before approval). In
 * a diaspora committee each time is also shown in the phone's own time zone (FR-DSP-002, 005).
 */
export function Meetings({ items, abroad }: { items: CommitteeItem[]; abroad: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const meetings = meetingsWithMinutes(items);
  if (meetings.length === 0) return <Empty text={t('m.committees.noMeetings')} />;
  return (
    <View style={styles.list}>
      {meetings.map(({ meeting, minutes }) => (
        <SurfaceCard key={meeting.id} style={styles.card}>
          <AppText step="card">{meeting.title}</AppText>
          {meeting.startsAt ? (
            <AppText step="secondary" tone="secondary">
              {t('m.committees.sriLankaTime', { time: formatDateTime(meeting.startsAt, language) })}
            </AppText>
          ) : null}
          {abroad && meeting.startsAt ? (
            <AppText step="secondary" tone="secondary">
              {t('m.committees.yourTime', { time: deviceTime(meeting.startsAt, language) })}
            </AppText>
          ) : null}
          {meeting.place ? (
            <AppText step="secondary" tone="muted">
              {t('m.committees.place', { place: meeting.place })}
            </AppText>
          ) : null}
          <AppText step="body">{meeting.body}</AppText>
          <View style={styles.minutes}>
            <AppText step="label">{t('m.committees.minutes')}</AppText>
            {minutes.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.committees.noMinutes')}
              </AppText>
            ) : (
              minutes.map((item) => (
                <Collapsible key={item.id} title={item.title}>
                  <AppText step="body">{item.body}</AppText>
                </Collapsible>
              ))
            )}
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}

/** Documents the member's role may open (FR-COM-007); the server leaves out the others. */
export function Documents({ items }: { items: CommitteeItem[] }) {
  const { t } = useTranslation();
  const documents = items.filter((item) => item.itemType === 'document');
  if (documents.length === 0) return <Empty text={t('m.committees.noDocuments')} />;
  return (
    <SurfaceCard style={styles.card}>
      {documents.map((item) => (
        <View key={item.id} style={styles.document}>
          <Collapsible title={item.title}>
            <View style={styles.documentBody}>
              {item.accessRoles.length < 3 ? (
                <StatusTag
                  tone="neutral"
                  label={t('m.committees.restricted', {
                    roles: item.accessRoles.map((role) => t(`m.committees.role_${role}`)).join(', '),
                  })}
                />
              ) : null}
              <AppText step="body">{item.body}</AppText>
            </View>
          </Collapsible>
        </View>
      ))}
    </SurfaceCard>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <AppText step="secondary" tone="muted">
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  minutes: { gap: spacing[1], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
  document: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  documentBody: { gap: spacing[2], paddingBottom: spacing[3] },
});
