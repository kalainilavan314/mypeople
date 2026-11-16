import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens';
import { AppText, formatDate, Screen, SurfaceCard, useApiQuery, useLanguage, useMember } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** C05: only confirmed personal milestones, ordered by date; no score or comparison. */
export default function CardProgressScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const member = useMember();
  const activity = useApiQuery(() => api().listMyActivity({ limit: 50 }));

  return (
    <Screen edges={['bottom']} maxContentWidth={640} title={t('m.card.progressTitle')} subtitle={t('m.card.progressHint')} onRefresh={activity.reload}>
      <QueryView query={activity}>{(items) => {
        const milestones = [
          { key: 'joined', at: member.joinedAt, title: t('m.card.milestoneJoined'), detail: member.memberCode },
          ...items.filter((item) => (item.kind === 'event' && item.state === 'attended') ||
            (item.kind === 'identity_review' && item.state === 'verified')).map((item) => ({
            key: `${item.kind}-${item.reference}`,
            at: item.at,
            title: item.kind === 'event' ? t('m.card.milestoneAttended') : t('m.card.milestoneVerified'),
            detail: item.title ?? item.reference,
          })),
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
