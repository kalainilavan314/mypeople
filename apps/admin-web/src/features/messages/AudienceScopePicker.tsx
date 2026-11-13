'use client';

import type { StaffTier } from '@my-people/api-client';
import { useState } from 'react';

export const STAFF_TIERS = ['1', '2A', '2B', '3A', '3B', '4', '5'] as const satisfies readonly StaffTier[];
type ReachKey = StaffTier | 'all';
type AreaOption = { value: string; label: string; reaches: Partial<Record<ReachKey, number | null>> };

/** The draft's selected geography updates the reach estimate before it is saved. */
export function AudienceScopePicker({ options }: { options: AreaOption[] }) {
  const [selected, setSelected] = useState(options[0]?.value ?? '');
  const [selectedTier, setSelectedTier] = useState<ReachKey>('all');
  const active = options.find((option) => option.value === selected);
  const reach = active?.reaches[selectedTier];

  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm font-semibold text-text">
        Audience geography (scoped to your role) *
        <select name="areaSelection" required value={selected} onChange={(event) => setSelected(event.target.value)} className="min-h-11 rounded-lg border border-line bg-surface px-3">
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-text">
        Audience staff tier
        <select
          name="audienceTier"
          value={selectedTier}
          onChange={(event) => setSelectedTier(event.target.value as ReachKey)}
          className="min-h-11 rounded-lg border border-line bg-surface px-3"
        >
          <option value="all">All active members</option>
          {STAFF_TIERS.map((tier) => <option key={tier} value={tier}>Staff Tier {tier}</option>)}
        </select>
      </label>
      <p role="status" aria-live="polite" className="text-sm text-muted sm:col-span-2">
        {reach === null || reach === undefined
          ? 'Audience estimate unavailable. Save the draft to check reach before sending.'
          : `Estimated reach: ${reach.toLocaleString()} members. Rechecked before approval and dispatch.`}
      </p>
      {selectedTier !== 'all' ? (
        <p className="text-xs text-muted sm:col-span-2">
          Staff tier targets members who currently hold an effective Tier {selectedTier} assignment in this geography. It is not a member ranking.
        </p>
      ) : null}
    </div>
  );
}
