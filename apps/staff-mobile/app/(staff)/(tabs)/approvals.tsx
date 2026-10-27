import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Screen, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { AlbumItem, AreaChangeItem, BroadcastItem, RemovalItem } from '@/features/approvals/ApprovalItems';
import { approvalCount, approvesAnything, loadApprovals } from '@/features/approvals/loadApprovals';
import { useStaff } from '@/providers/StaffProvider';

function Section({ title, show, children }: { title: string; show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <>
      <AppText step="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </>
  );
}

/**
 * S13: decisions waiting for this person, only from the queues their roles
 * allow and only in their areas. Every decision needs a reason where the
 * rules ask for one; the API checks permission, area and who may decide.
 */
export default function ApprovalsScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const approvals = useApiQuery(() => loadApprovals(permissions), [permissions]);
  useReloadOnFocus(approvals.reload);

  if (!approvesAnything(permissions)) {
    return (
      <Screen edges={[]}>
        <AppText step="secondary" tone="muted">
          {t('s.approvals.noPermission')}
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} onRefresh={approvals.reload} refreshing={approvals.loading && approvals.data !== undefined}>
      <QueryView query={approvals}>
        {(data) => (
          <>
            {approvalCount(data) === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('s.approvals.none')}
              </AppText>
            ) : null}
            <Section title={t('s.approvals.removals')} show={data.removals.length > 0}>
              {data.removals.map((request) => (
                <RemovalItem key={request.id} request={request} onDone={approvals.reload} />
              ))}
            </Section>
            <Section title={t('s.approvals.broadcasts')} show={data.broadcasts.length > 0}>
              {data.broadcasts.map((broadcast) => (
                <BroadcastItem key={broadcast.id} broadcast={broadcast} onDone={approvals.reload} />
              ))}
            </Section>
            <Section title={t('s.approvals.areaChanges')} show={data.areaChanges.length > 0}>
              {data.areaChanges.map((change) => (
                <AreaChangeItem key={change.id} change={change} onDone={approvals.reload} />
              ))}
            </Section>
            <Section title={t('s.approvals.albums')} show={data.albums.length > 0}>
              {data.albums.map((album) => (
                <AlbumItem key={album.id} album={album} onDone={approvals.reload} />
              ))}
            </Section>
          </>
        )}
      </QueryView>
    </Screen>
  );
}
