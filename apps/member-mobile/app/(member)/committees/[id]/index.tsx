import type { CommitteeSpace } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  confirmAction,
  MenuRow,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { Discussion } from '@/features/committees/Discussion';
import { MembershipPanel } from '@/features/committees/MembershipPanel';
import { Announcements, Documents, Meetings } from '@/features/committees/SpaceItems';
import { TaskList } from '@/features/committees/TaskList';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Section = 'news' | 'meetings' | 'tasks' | 'documents' | 'discussion';
const SECTIONS: readonly Section[] = ['news', 'meetings', 'tasks', 'documents', 'discussion'];

/**
 * M32 Committee space: for its approved members, this committee's announcements, meetings with
 * approved minutes, tasks and volunteer opportunities, the documents their role may open and the
 * moderated discussion; for anyone else, what the committee is for and how to apply (FR-COM-002 to 008).
 */
export default function CommitteeSpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const space = useApiQuery(() => api().getCommitteeSpace(id), [id]);
  useReloadOnFocus(space.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={space.reload}
      refreshing={space.loading && space.data !== undefined}>
      <FeatureQueryView feature="committees" query={space}>
        {(data) => <SpaceView space={data} reload={space.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function SpaceView({ space, reload }: { space: CommitteeSpace; reload: () => void }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [section, setSection] = useState<Section>('news');
  const { committee, myMembership } = space;
  const member = myMembership?.state === 'approved' && committee.state === 'active';
  const role = member ? myMembership?.role ?? null : null;
  const leave = useApiAction(async () => {
    await api().leaveCommittee(committee.id);
    reload();
  });

  return (
    <>
      <SurfaceCard style={styles.card}>
        <AppText step="caption" tone="primary">
          {committee.wingNameEn
            ? localized(committee.wingNameEn, committee.wingNameTa ?? '')
            : t(`m.committees.wing_${committee.wingType}`)}
        </AppText>
        <AppText step="title" accessibilityRole="header">
          {localized(committee.nameEn, committee.nameTa)}
        </AppText>
        <AppText step="body" tone="secondary">
          {localized(committee.purposeEn, committee.purposeTa)}
        </AppText>
        <View style={styles.tags}>
          <StatusTag tone="neutral" label={t('m.committees.members', { count: committee.members })} />
          {role ? <StatusTag tone="verified" label={t(`m.committees.role_${role}`)} /> : null}
        </View>
      </SurfaceCard>

      {!member ? (
        <MembershipPanel space={space} onChanged={reload} />
      ) : (
        <>
          {role === 'coordinator' || role === 'secretary' ? (
            <SurfaceCard style={styles.rowCard}>
              <MenuRow
                first
                icon="clipboard-outline"
                tint="teal"
                label={t('m.committees.openTools')}
                hint={t('m.committees.openToolsHint')}
                onPress={() => router.push({ pathname: '/committees/[id]/coordinate', params: { id: committee.id } })}
              />
            </SurfaceCard>
          ) : null}

          <ChipRow
            label={t('m.committees.sections')}
            selected={section}
            onSelect={setSection}
            options={SECTIONS.map((key) => ({ key, label: t(`m.committees.section_${key}`) }))}
          />

          {section === 'news' ? <Announcements items={space.items} /> : null}
          {section === 'meetings' ? <Meetings items={space.items} abroad={committee.wingType === 'diaspora'} /> : null}
          {section === 'tasks' ? <TaskList committeeId={committee.id} items={space.items} onChanged={reload} /> : null}
          {section === 'documents' ? <Documents items={space.items} /> : null}
          {section === 'discussion' ? (
            <Discussion
              committeeId={committee.id}
              items={space.items}
              waiting={space.myWaiting}
              moderated={role === 'member'}
              onChanged={reload}
            />
          ) : null}

          {leave.error ? <Notice tone="error">{errorMessage(t, leave.error, 'committees')}</Notice> : null}
          <Button
            variant="danger"
            label={t('m.committees.leave')}
            busy={leave.busy}
            onPress={async () => {
              const sure = await confirmAction({
                title: t('m.committees.leave'),
                message: t('m.committees.leaveConfirm'),
                confirmLabel: t('m.committees.leave'),
                cancelLabel: t('m.common.cancel'),
                destructive: true,
              });
              if (sure) void leave.run();
            }}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  rowCard: { paddingVertical: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
