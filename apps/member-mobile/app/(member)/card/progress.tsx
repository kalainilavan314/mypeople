import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, Screen, SurfaceCard, useApiQuery, useLanguage, useMember } from '@my-people/mobile-ui';
import type { ActivityKind } from '@my-people/api-client';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** The milestone an activity item marks, if any: completing a course is one (H15, FR-LRN-004). */
const MILESTONES: Partial<Record<ActivityKind, { state: string; title: string }>> = {
  event: { state: 'attended', title: 'm.card.milestoneAttended' },
  identity_review: { state: 'verified', title: 'm.card.milestoneVerified' },
  course: { state: 'completed', title: 'm.card.milestoneCourse' },
};

/** C05: only confirmed personal milestones, ordered by date; no score or comparison. */
export default function CardProgressScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const member = useMember();
  // The API's largest page, so an older course or event is not left out by newer activity.
  const activity = useApiQuery(() => api().listMyActivity({ limit: 200 }));

  return (
    <Screen edges={['bottom']} maxContentWidth={640} title={t('m.card.progressTitle')} subtitle={t('m.card.progressHint')} onRefresh={activity.reload}>
      <QueryView query={activity}>{(items) => {
        const milestones = [
          { key: 'joined', at: member.joinedAt, title: t('m.card.milestoneJoined'), detail: member.memberCode },
          ...items.flatMap((item) => {
            const milestone = MILESTONES[item.kind];
            if (!milestone || milestone.state !== item.state) return [];
            return [{ key: `${item.kind}-${item.reference}`, at: item.at, title: t(milestone.title), detail: item.title ?? item.reference }];
          }),
        ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        return milestones.length > 0 ? (
          <SurfaceCard>
            {milestones.map((item, index) => (
              <View key={item.key} style={[styles.item, index < milestones.length - 1 && styles.divider]}>
                <AppText step="caption" tone="muted">{formatDate(item.at, language)}</AppText>
                <AppText step="card">{item.title}</AppText>
                <AppText step="secondary" tone="secondary">{item.detail}</AppText>
              </View>
            ))}
          </SurfaceCard>
        ) : <AppText step="body" tone="muted">{t('m.card.progressEmpty')}</AppText>;
      }}</QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing[1], paddingVertical: spacing[3] },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
});
