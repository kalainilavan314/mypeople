import type { AreaUpdate, IssueSummary, MyArea } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  MenuRow,
  Screen,
  SegmentedControl,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { IssueCard } from '@/features/issues/IssueCard';
import { IssuesQueryView } from '@/features/issues/IssuesQueryView';
import { IssueStatusTag } from '@/features/issues/IssueStatusTag';
import { NoAreaNotice } from '@/features/issues/NoAreaNotice';
import { api } from '@/lib/api';

type Segment = 'updates' | 'issues' | 'projects';

function segmentFrom(param: string | undefined): Segment {
  return param === 'issues' || param === 'projects' ? param : 'updates';
}

/**
 * H05 My area: Updates, Issues and Projects published for the member's GN division
 * (FR-RPT-001, 003). A list only: there are no GN boundaries to draw a map from, and a made-up
 * map would pretend to know where things are. Home's Local reports and Area projects tiles open
 * it on their own segment (?segment=issues or projects).
 */
export default function MyAreaScreen() {
  const { segment: param } = useLocalSearchParams<{ segment?: string }>();
  const area = useApiQuery(() => api().getMyArea());
  useReloadOnFocus(area.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={area.reload} refreshing={area.loading && area.data !== undefined}>
      <IssuesQueryView query={area}>{(data) => <AreaBody area={data} initial={segmentFrom(param)} />}</IssuesQueryView>
    </Screen>
  );
}

function AreaBody({ area, initial }: { area: MyArea; initial: Segment }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [segment, setSegment] = useState<Segment>(initial);
  useEffect(() => setSegment(initial), [initial]);

  if (!area.hasArea) {
    return (
      <>
        <NoAreaNotice />
        <MyReportsRow />
      </>
    );
  }

  const gnName = area.gnNameEn ? localized(area.gnNameEn, area.gnNameTa ?? '') : null;

  return (
    <>
      <SurfaceCard accent style={styles.hero}>
        <AppText step="caption" tone="primary">
          {t('m.issues.gnDivision')}
        </AppText>
        {gnName ? (
          <AppText step="page" accessibilityRole="header">
            {gnName}
          </AppText>
        ) : null}
        <AppText step="secondary" tone="secondary">
          {t('m.issues.areaIntro')}
        </AppText>
      </SurfaceCard>

      <Button label={t('m.issues.reportConcern')} icon="megaphone-outline" onPress={() => router.push('/issues/report')} />
      <MyReportsRow />

      <SegmentedControl
        label={t('m.issues.show')}
        selected={segment}
        onSelect={setSegment}
        options={[
          { key: 'updates', label: t('m.issues.segmentUpdates') },
          { key: 'issues', label: t('m.issues.segmentIssues') },
          { key: 'projects', label: t('m.issues.segmentProjects') },
        ]}
      />

      {segment === 'updates' ? <UpdateList updates={area.updates} /> : null}
      {segment === 'issues' ? <IssueList issues={area.issues} empty={t('m.issues.noIssues')} /> : null}
      {segment === 'projects' ? <IssueList issues={area.projects} empty={t('m.issues.noProjects')} /> : null}
    </>
  );
}

function MyReportsRow() {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.rowCard}>
      <MenuRow
        first
        icon="document-text-outline"
        label={t('m.issues.myReports')}
        hint={t('m.issues.myReportsHint')}
        onPress={() => router.push('/issues/mine')}
      />
    </SurfaceCard>
  );
}

function IssueList({ issues, empty }: { issues: IssueSummary[]; empty: string }) {
  if (issues.length === 0) {
    return (
      <AppText step="secondary" tone="muted">
        {empty}
      </AppText>
    );
  }
  return (
    <View style={styles.list}>
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </View>
  );
}

/** Each published stage change in the area, newest first. */
function UpdateList({ updates }: { updates: AreaUpdate[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  if (updates.length === 0) {
    return (
      <AppText step="secondary" tone="muted">
        {t('m.issues.noUpdates')}
      </AppText>
    );
  }
  return (
    <SurfaceCard style={styles.updates}>
      {updates.map((update, index) => {
        const title = localized(update.titleEn, update.titleTa) || t('m.issues.untitled');
        const moved = t('m.issues.movedTo', { number: update.stage, stage: t(`m.issues.stage_${update.stage}`) });
        const when = formatDateTime(update.at, language);
        return (
          <SurfaceCard
            key={`${update.issueId}-${update.at}`}
            onPress={() => router.push({ pathname: '/issues/[id]', params: { id: update.issueId } })}
            accessibilityLabel={`${title}. ${moved}. ${t(`m.issues.status_${update.status}`)}. ${when}`}
            accessibilityHint={t('m.issues.opensIssue')}
            style={[styles.update, index > 0 && styles.updateDivider]}>
            <AppText step="card">{title}</AppText>
            <AppText step="secondary" tone="muted" mono>
              {update.caseNumber}
            </AppText>
            <AppText step="secondary" tone="secondary">
              {moved}
            </AppText>
            <View style={styles.meta}>
              <IssueStatusTag status={update.status} />
              <AppText step="caption" tone="muted" style={styles.flex}>
                {when}
              </AppText>
            </View>
          </SurfaceCard>
        );
      })}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer, gap: spacing[1] },
  rowCard: { paddingVertical: 0 },
  list: { gap: spacing[3] },
  updates: { padding: 0, gap: 0, overflow: 'hidden' },
  update: { borderWidth: 0, borderRadius: 0, padding: spacing[4] },
  updateDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  flex: { flex: 1 },
});
