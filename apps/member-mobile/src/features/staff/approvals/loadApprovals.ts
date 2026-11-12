import type { Broadcast, ManagedAlbum, QueuedAreaChange, QueuedRemoval } from '@my-people/api-client';

import { api } from '@/lib/api';

export type Approvals = {
  broadcasts: Broadcast[];
  areaChanges: QueuedAreaChange[];
  albums: ManagedAlbum[];
  removals: QueuedRemoval[];
};

/**
 * S13: what waits for this person's decision, asked only of the queues their
 * roles allow; the API limits each to their areas and checks every decision.
 */
export async function loadApprovals(permissions: ReadonlySet<string>): Promise<Approvals> {
  const [broadcasts, areaChanges, albumSummaries, removals] = await Promise.all([
    permissions.has('notifications.send') ? api().listBroadcasts({ states: ['pending_approval'] }) : [],
    permissions.has('members.verify') ? api().listAreaChanges({ states: ['submitted'] }) : [],
    permissions.has('gallery.publish') ? api().listManagedAlbums({ states: ['submitted'] }) : [],
    permissions.has('gallery.takedown') ? api().listRemovalRequests({ states: ['open'] }) : [],
  ]);
  // The album list is a summary; publishing needs the captions in front of the approver.
  const albums = await Promise.all(albumSummaries.map((album) => api().getManagedAlbum(album.id)));
  return { broadcasts, areaChanges, albums, removals };
}

export function approvalCount(approvals: Approvals): number {
  return approvals.broadcasts.length + approvals.areaChanges.length + approvals.albums.length + approvals.removals.length;
}

/** Whether this person's roles include any approval queue at all. */
export function approvesAnything(permissions: ReadonlySet<string>): boolean {
  return ['notifications.send', 'members.verify', 'gallery.publish', 'gallery.takedown'].some((p) => permissions.has(p));
}
