'use client';

import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { closeWithReport, recordProgress } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, TEXTAREA } from './fields';
import type { CaseFormState } from './forms';

// W08: the implementation owner records progress and closes the case with a closing report
// (FR-WEB-025, FR-WEB-026).

const MAX_PHOTOS = 6;
// One report's photos travel in one Server Action request: next.config.ts allows 15 MB, as nginx does
// (client_max_body_size), so the photos must stay below that, leaving room for the text.
const MAX_PHOTO_BYTES = 14 * 1024 * 1024;

type Picked = { count: number; bytes: number };

function photoProblem(picked: Picked): string | null {
  if (picked.count > MAX_PHOTOS) return `Choose at most ${MAX_PHOTOS} photos.`;
  if (picked.bytes > MAX_PHOTO_BYTES) {
    return `These photos come to ${(picked.bytes / (1024 * 1024)).toFixed(1)} MB; one report can carry at most 14 MB of photos. Choose smaller photos, or write the evidence as references.`;
  }
  return null;
}

function PhotoPicker({ form, state, onPick }: { form: string; state: CaseFormState; onPick: (picked: Picked) => void }) {
  const [picked, setPicked] = useState<Picked>({ count: 0, bytes: 0 });
  const problem = photoProblem(picked);
  return (
    <CaseField
      form={form}
      name="photos"
      label="Photos (optional)"
      hint="JPEG, PNG or WebP, up to 6 photos and 14 MB in all. They are kept with the case, not shown to the public."
      state={state}>
      {(control) => (
        <>
          <input
            {...control}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const next = { count: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) };
              setPicked(next);
              onPick(next);
            }}
            className="text-sm"
          />
          {picked.count > 0 ? (
            <p className="text-xs text-muted">
              {picked.count} {picked.count === 1 ? 'photo' : 'photos'} chosen ({(picked.bytes / 1024).toFixed(0)} KB)
            </p>
          ) : null}
          {problem ? (
            <p role="status" className="text-xs font-semibold text-error">
              ! {problem}
            </p>
          ) : null}
        </>
      )}
    </CaseField>
  );
}

export function ProgressForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(recordProgress, null);
  return (
    <ActionCard id="progress" title="Record progress" intro="Each step done against the approved scope, with its evidence.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="progress" state={state} fields={['step', 'evidenceRefs', 'photos']} />
        <input type="hidden" name="caseId" value={caseId} />
        <ProgressFields state={state} />
      </form>
    </ActionCard>
  );
}

function ProgressFields({ state }: { state: CaseFormState }) {
  const values = state?.values ?? {};
  const [picked, setPicked] = useState<Picked>({ count: 0, bytes: 0 });
  const blocked = photoProblem(picked) !== null;
  return (
    <>
      <CaseField form="progress" name="step" label="Step completed" required state={state}>
        {(control) => <textarea {...control} required minLength={3} maxLength={2000} rows={3} defaultValue={values.step} className={TEXTAREA} />}
      </CaseField>
      <CaseField form="progress" name="evidenceRefs" label="Evidence references" hint="One per line. Up to 20." state={state}>
        {(control) => <textarea {...control} rows={2} defaultValue={values.evidenceRefs} className={TEXTAREA} />}
      </CaseField>
      <PhotoPicker form="progress" state={state} onPick={setPicked} />
      <CaseSubmit ready={!blocked}>Record progress</CaseSubmit>
    </>
  );
}

/** FR-WEB-026: Submit stays off until there is evidence: a reference, a photo, or both. */
export function ClosingReportForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(closeWithReport, null);
  return (
    <ActionCard
      id="close"
      title="Closing report"
      intro="The case becomes Resolved. The reporter and followers see the member summary, in Tamil and English, and may challenge it within 30 days.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="close" state={state} fields={['outcome', 'evidenceRefs', 'photos', 'limitations', 'summaryTa', 'summaryEn']} />
        <input type="hidden" name="caseId" value={caseId} />
        <ClosingFields state={state} />
      </form>
    </ActionCard>
  );
}

function ClosingFields({ state }: { state: CaseFormState }) {
  const values = state?.values ?? {};
  const [refs, setRefs] = useState(values.evidenceRefs ?? '');
  const [picked, setPicked] = useState<Picked>({ count: 0, bytes: 0 });
  const hasEvidence = refs.trim() !== '' || picked.count > 0;
  const ready = hasEvidence && photoProblem(picked) === null;

  return (
    <>
      <CaseField form="close" name="outcome" label="Outcome" required state={state}>
        {(control) => <textarea {...control} required minLength={10} maxLength={4000} rows={4} defaultValue={values.outcome} className={TEXTAREA} />}
      </CaseField>
      <CaseField form="close" name="evidenceRefs" label="Evidence references" hint="One per line. A closing report needs at least one reference or one photo." state={state}>
        {(control) => (
          <textarea {...control} rows={3} defaultValue={refs} onChange={(event) => setRefs(event.target.value)} className={TEXTAREA} />
        )}
      </CaseField>
      <PhotoPicker form="close" state={state} onPick={setPicked} />
      <CaseField form="close" name="limitations" label="Limitations (optional)" hint="Anything the work did not cover." state={state}>
        {(control) => <textarea {...control} maxLength={2000} rows={2} defaultValue={values.limitations} className={TEXTAREA} />}
      </CaseField>
      <div className="grid gap-4 md:grid-cols-2">
        <CaseField form="close" name="summaryTa" label="Member summary in Tamil" required state={state}>
          {(control) => <textarea {...control} lang="ta" required minLength={10} maxLength={1500} rows={4} defaultValue={values.summaryTa} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="close" name="summaryEn" label="Member summary in English" required state={state} codes={['bilingual_summary_required']}>
          {(control) => <textarea {...control} lang="en" required minLength={10} maxLength={1000} rows={4} defaultValue={values.summaryEn} className={`${CONTROL} py-2`} />}
        </CaseField>
      </div>
      {!hasEvidence ? (
        <p id="close-waiting" className="text-sm text-muted">
          Add an evidence reference or a photo to submit the closing report.
        </p>
      ) : null}
      <CaseSubmit ready={ready} describedBy={!hasEvidence ? 'close-waiting' : undefined}>
        Submit closing report
      </CaseSubmit>
    </>
  );
}
