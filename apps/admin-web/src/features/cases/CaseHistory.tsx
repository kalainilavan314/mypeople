import type { CaseAction } from '@my-people/api-client';

import { formatDateTime } from '@/lib/format';

import { changesOwner, detailLines, historyTitle, noteLabel } from './history';
import { stageLabel } from './stages';

/** The recorded details of one entry as a description list. */
export function EntryDetails({ entry }: { entry: CaseAction }) {
  const lines = detailLines(entry);
  if (lines.length === 0) return null;
  return (
    <dl className="grid gap-2 text-sm">
      {lines.map((line) => (
        <div key={line.label}>
          <dt className="text-xs text-muted">{line.label}</dt>
          <dd className="whitespace-pre-wrap text-text">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OwnerChange({ entry }: { entry: CaseAction }) {
  if (!changesOwner(entry)) return null;
  return (
    <p className="text-sm text-text">
      <span className="text-muted">Owner: </span>
      {entry.previousOwnerName ?? 'no owner'} <span aria-hidden="true">→</span>
      <span className="sr-only"> to </span> <span className="font-semibold">{entry.newOwnerName ?? 'no owner'}</span>
    </p>
  );
}

/**
 * FR-WEB-029: every step and handover, oldest first, with who did it, the stage it moved between,
 * the previous and the new owner, the note and the time. Reports shown in full above link there.
 */
export function CaseHistory({ history, reportAnchor }: { history: readonly CaseAction[]; reportAnchor: (entry: CaseAction) => string | null }) {
  if (history.length === 0) return <p className="text-sm text-muted">Nothing has been recorded yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {history.map((entry) => {
        const anchor = reportAnchor(entry);
        return (
          <li key={entry.id} className="flex flex-col gap-2 border-l-2 border-line pl-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-text">{historyTitle(entry)}</p>
              <time dateTime={entry.createdAt} className="text-xs tabular-nums text-muted">
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <p className="text-xs text-muted">{entry.actorName ? `By ${entry.actorName}` : 'Recorded by the system'}</p>
            {entry.fromStage && entry.toStage && entry.fromStage !== entry.toStage ? (
              <p className="text-sm text-text">
                <span className="text-muted">Stage: </span>
                {stageLabel(entry.fromStage).en} <span aria-hidden="true">→</span>
                <span className="sr-only"> to </span> <span className="font-semibold">{stageLabel(entry.toStage).en}</span>
              </p>
            ) : null}
            <OwnerChange entry={entry} />
            {entry.note ? (
              <div className="text-sm">
                <p className="text-xs text-muted">{noteLabel(entry.kind)}</p>
                <p className="whitespace-pre-wrap text-text">{entry.note}</p>
              </div>
            ) : null}
            {anchor ? (
              <a href={`#${anchor}`} className="w-fit text-sm font-semibold text-primary underline">
                See the full report
              </a>
            ) : (
              <EntryDetails entry={entry} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
