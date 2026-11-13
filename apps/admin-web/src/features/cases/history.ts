import type { CaseAction } from '@my-people/api-client';

import { formatDate, formatDateTime } from '../../lib/format.ts';
import { FINDING_LABELS, isFindingKind, stageLabel } from './stages.ts';

// How each kind of case history entry reads on the case file (FR-WEB-029). An escalation reads
// "Escalated", never "Approved" (BR-035, BR-037).

const TITLES: Record<string, string> = {
  submitted: 'Reported by a member',
  reporter_replied: 'The reporter added the details asked for',
  challenged: 'The reporter challenged the closure',
  fact: 'Fact recorded',
  finding: 'Research finding recorded',
  note: 'Note',
  returned: 'Returned to the reporter for details',
  forwarded: 'Forwarded to divisional research',
  ds_report: 'Divisional report sent to the district',
  district_action: 'District acted within delegated authority',
  escalated: 'Escalated',
  regional_plan: 'Regional plan sent for executive approval',
  executive_approved: 'Approved with conditions',
  executive_returned: 'Returned for clarification',
  executive_declined: 'Declined',
  progress: 'Progress recorded',
  closed: 'Closed with a closing report',
  linked: 'Linked to a parent case',
  assigned: 'Handed over',
  reopened: 'Closure challenge accepted: case reopened',
  challenge_rejected: 'Closure challenge rejected',
  breach_alerted: 'Stage time limit passed: supervisors alerted',
  addition_moderated: 'Added information moderated',
  public_summary: 'Public summary changed',
};

const NOTE_LABELS: Record<string, string> = {
  forwarded: 'Handover note',
  ds_report: 'Recommendation',
  district_action: 'Approved scope',
  regional_plan: 'Solution',
  executive_approved: 'Approved scope',
  assigned: 'Handover note',
  returned: 'Question',
  escalated: 'Reason',
  executive_returned: 'Question',
  executive_declined: 'Reason',
  progress: 'Step',
  closed: 'Outcome',
  reopened: 'Reason',
  challenge_rejected: 'Reason',
  challenged: 'Reporter’s note',
  public_summary: 'Reason',
  addition_moderated: 'Reason',
};

/**
 * Handovers whose note repeats one of their own details (the recommendation, the solution, the
 * approved scope): the history shows the note, the full report shows the details only once.
 */
export const NOTE_IN_DETAILS: ReadonlySet<string> = new Set(['ds_report', 'district_action', 'regional_plan', 'executive_approved']);

/** Reports and decisions the case file also shows in full, version by version. */
export const REPORT_KINDS: ReadonlySet<string> = new Set([
  'ds_report',
  'district_action',
  'escalated',
  'regional_plan',
  'executive_approved',
  'executive_returned',
  'executive_declined',
  'progress',
  'closed',
]);

function value(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (Array.isArray(raw)) {
    const items = raw.map(value).filter((item): item is string => item !== null);
    return items.length ? items.join('\n') : null;
  }
  return null;
}

export function historyTitle(entry: Pick<CaseAction, 'kind' | 'details'>): string {
  if (entry.kind === 'public_summary') {
    return entry.details.action === 'published' ? 'Public summary published' : 'Public summary withheld';
  }
  if (entry.kind === 'addition_moderated') {
    if (entry.details.appeal) return 'Added information approved on appeal';
    if (entry.details.approved !== true) return 'Added information rejected';
    return entry.details.redacted === true ? 'Added information approved as an edited version' : 'Added information approved';
  }
  if ((entry.kind === 'ds_report' || entry.kind === 'regional_plan') && value(entry.details.version)) {
    return `${TITLES[entry.kind]} (version ${value(entry.details.version)})`;
  }
  return TITLES[entry.kind] ?? entry.kind.replace(/_/g, ' ');
}

export function noteLabel(kind: string): string {
  return NOTE_LABELS[kind] ?? 'Note';
}

export type DetailLine = { label: string; value: string };

/** The recorded details of one entry, labelled; empty ones are left out. */
export function detailLines(entry: Pick<CaseAction, 'kind' | 'details'>): DetailLine[] {
  const d = entry.details;
  const lines: [string, string | null][] = (() => {
    switch (entry.kind) {
      case 'fact':
        return [['Fact', value(d.statement)], ['Source', value(d.source)]];
      case 'finding':
        return [
          ['Kind', isFindingKind(d.kind) ? FINDING_LABELS[d.kind].en : value(d.kind)],
          ['Finding', value(d.statement)],
          ['Source', value(d.source)],
        ];
      case 'forwarded':
        return [
          ['Completeness check', 'Location confirmed, description clear, evidence reviewed'],
          ['Affected area', value(d.affectedArea)],
        ];
      case 'ds_report':
        return [
          ['Summary', value(d.summary)],
          ['Evidence', value(d.evidenceRefs)],
          ['Recommendation', value(d.recommendation)],
        ];
      case 'district_action':
        return [
          ['Approved scope', value(d.scope)],
          ['Delegated authority', value(d.authority)],
          ['Resources', value(d.resources)],
          ['Responsible office', value(d.office)],
          ['Due date', typeof d.dueDate === 'string' ? formatDate(d.dueDate) : null],
        ];
      case 'escalated':
        return [['Decision required', value(d.decisionRequired)]];
      case 'regional_plan':
        return [
          ['Solution', value(d.solution)],
          ['Responsible tier', value(d.responsibleTier) ? `Tier ${value(d.responsibleTier)}` : null],
          ['Resources', value(d.resources)],
          ['Expected outcome', value(d.expectedOutcome)],
          ['Reporting plan', value(d.reportingPlan)],
        ];
      case 'executive_approved':
        return [
          ['Conditions', value(d.conditions)],
          ['Approved scope', value(d.scope)],
          ['Reporting duty', value(d.reportingDuty)],
          ['Due date', typeof d.dueDate === 'string' ? formatDate(d.dueDate) : null],
        ];
      case 'progress':
        return [['Evidence', value(d.evidenceRefs)]];
      case 'closed':
        return [
          ['Evidence', value(d.evidenceRefs)],
          ['Limitations', value(d.limitations)],
          ['Decided at', d.level === 'district' ? 'District level' : d.level === 'executive' ? 'Executive level' : value(d.level)],
        ];
      case 'linked':
        return [['Parent case', value(d.parent)]];
      case 'breach_alerted':
        return [
          ['Stage', typeof d.stage === 'string' ? stageLabel(d.stage).en : null],
          ['Was due', typeof d.dueAt === 'string' ? formatDateTime(d.dueAt) : null],
          ['People alerted', value(d.alerted)],
        ];
      case 'submitted':
        return [['Photos with the report', value(d.photos)]];
      default:
        return [];
    }
  })();
  return lines.filter((line): line is [string, string] => line[1] !== null).map(([label, text]) => ({ label, value: text }));
}

/** True for an entry that moves the case or changes its owner: the handover line is shown for it. */
export function changesOwner(entry: Pick<CaseAction, 'kind' | 'toStage' | 'previousOwnerName' | 'newOwnerName'>): boolean {
  return entry.kind === 'assigned' || entry.toStage !== null || entry.previousOwnerName !== null || entry.newOwnerName !== null;
}
