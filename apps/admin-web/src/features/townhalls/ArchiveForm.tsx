'use client';

import { useActionState } from 'react';

import { ActionCard, ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import { RowsBuilder } from '@/components/RowsBuilder';
import type { FormState } from '@/lib/formState';

import { archiveTownHall } from './actions';
import { TOWNHALL_TARGETS } from './forms';

/**
 * FR-THL-007: the archive of an ended session: the recording, the transcripts, and the outcomes,
 * each linked to a promise id or a community case number where there is one.
 */
export function ArchiveForm({ townhallId, current }: { townhallId: string; current: Record<string, string> }) {
  const [state, action] = useActionState<FormState, FormData>(archiveTownHall, null);
  const values = state?.values ?? current;
  return (
    <ActionCard id="archive" title="Archive" intro="Saving replaces the recording link, transcripts and outcomes shown to members.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <ActionProblems form="archive" state={state} targets={TOWNHALL_TARGETS} fields={['recordingUrl', 'outcomesJson']} />
        <input type="hidden" name="townhallId" value={townhallId} />
        <ActionField form="archive" name="recordingUrl" label="Recording link (https, optional)" state={state} targets={TOWNHALL_TARGETS}>
          {(control) => <input {...control} type="url" pattern="https://.*" maxLength={500} defaultValue={values.recordingUrl} className={CONTROL} />}
        </ActionField>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form="archive" name="transcriptTa" label="Transcript in Tamil (optional)" state={state} targets={TOWNHALL_TARGETS}>
            {(control) => <textarea {...control} lang="ta" maxLength={300000} rows={6} defaultValue={values.transcriptTa} className={TEXTAREA} />}
          </ActionField>
          <ActionField form="archive" name="transcriptEn" label="Transcript in English (optional)" state={state} targets={TOWNHALL_TARGETS}>
            {(control) => <textarea {...control} lang="en" maxLength={200000} rows={6} defaultValue={values.transcriptEn} className={TEXTAREA} />}
          </ActionField>
        </div>
        <RowsBuilder
          form="archive"
          name="outcomesJson"
          legend="Outcomes / விளைவுகள்"
          rowLabel="Outcome"
          hint="Link an outcome to a promise (its id from the promise tracker) or a community case (its number, e.g. CS-1234) when there is one."
          max={50}
          initialJson={values.outcomesJson ?? '[]'}
          problems={(state?.problems ?? []).filter((problem) => problem.startsWith('outcome_text_required'))}
          columns={[
            { key: 'textTa', label: 'Outcome in Tamil', lang: 'ta', required: true, maxLength: 800 },
            { key: 'textEn', label: 'Outcome in English', lang: 'en', required: true, maxLength: 500 },
            { key: 'promiseId', label: 'Promise id (optional)', maxLength: 36, mono: true },
            { key: 'caseNumber', label: 'Case number (optional)', maxLength: 20, mono: true },
          ]}
        />
        <ActionSubmit>Save archive</ActionSubmit>
      </form>
    </ActionCard>
  );
}
