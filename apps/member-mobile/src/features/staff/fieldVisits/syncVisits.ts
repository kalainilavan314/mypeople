import type { FieldSyncResult } from '@my-people/api-client';

import { api } from '@/lib/api';

import { removeVisit, saveVisit, toInput, type LocalVisit } from './visitStore';

// The API takes at most 200 visits in one request (SyncIn).
const BATCH = 200;

/** What happened to one visit in this sync, shown on S07. */
export type SyncReport = { clientId: string; outcome: FieldSyncResult['outcome']; visitRef: string | null; version: number | null };

/**
 * S07: sends every visit waiting on the phone. A visit the server now holds (created, updated or
 * unchanged) leaves the phone; a refused one keeps its problems; a conflict keeps the server's copy
 * so the coordinator can compare. Each visit is judged on its own.
 */
export async function syncPending(memberId: string, visits: LocalVisit[]): Promise<SyncReport[]> {
  const pending = visits.filter((visit) => visit.status === 'pending');
  const reports: SyncReport[] = [];
  for (let start = 0; start < pending.length; start += BATCH) {
    const batch = pending.slice(start, start + BATCH);
    const results = await api().syncFieldVisits(batch.map(toInput));
    for (const result of results) {
      const visit = batch.find((item) => item.clientId === result.clientId);
      if (!visit) continue;
      if (result.outcome === 'refused') {
        await saveVisit(memberId, { ...visit, status: 'refused', problems: result.problems, server: null });
      } else if (result.outcome === 'conflict') {
        await saveVisit(memberId, { ...visit, status: 'conflict', problems: [], server: result.visit });
      } else {
        await removeVisit(memberId, visit.clientId);
      }
      reports.push({
        clientId: result.clientId,
        outcome: result.outcome,
        visitRef: result.visit?.visitRef ?? null,
        version: result.visit?.version ?? null,
      });
    }
  }
  return reports;
}
