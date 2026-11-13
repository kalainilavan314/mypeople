'use client';

import { useActionState, useState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, CheckRow, FieldErrors, TEXTAREA, fieldId, problemsFor } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { createSurvey, updateSurvey } from './actions';
import { SURVEY_TARGETS, SURVEY_TEXT_FIELDS, questionNumberOf } from './forms';
import { QuestionBuilder } from './QuestionBuilder';

const PAIRS = [
  { pair: 'title', en: 'Title', long: false, min: 5, maxTa: 160, maxEn: 120, hint: undefined },
  { pair: 'audience', en: 'Who it is for', long: false, min: 3, maxTa: 400, maxEn: 300, hint: 'Shown to members before they answer.' },
  {
    pair: 'privacy',
    en: 'How the answers are used and kept',
    long: true,
    min: 10,
    maxTa: 1500,
    maxEn: 1000,
    hint: 'Say who sees the results and that small groups are never shown.',
  },
  { pair: 'nextSteps', en: 'What happens next', long: true, min: 10, maxTa: 1500, maxEn: 1000, hint: undefined },
] as const;

/**
 * A survey draft (H14, H21): the text members see in Tamil and English, the area, whether it is
 * anonymous, an optional closing time and the questions. Editing replaces the whole draft.
 */
export function SurveyForm({
  surveyId,
  current,
  areaOptions = [],
  fixedArea,
  fixedAreaName,
}: {
  surveyId?: string;
  current?: Record<string, string>;
  areaOptions?: readonly AreaOption[];
  /** An existing draft keeps its area ("district:LK41"); the API sets it only when the survey is made. */
  fixedArea?: string;
  fixedAreaName?: string;
}) {
  const editing = Boolean(surveyId);
  const [state, action] = useActionState<FormState, FormData>(editing ? updateSurvey : createSurvey, null);
  const form = editing ? 'edit' : 'new';
  const values = state?.values ?? current ?? {};
  const fields = [...SURVEY_TEXT_FIELDS, 'closesAt', 'area', 'allowEdits', 'questions'];

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems
        form={form}
        state={state}
        targets={SURVEY_TARGETS}
        fields={fields}
        linkFor={(problem) => {
          const number = questionNumberOf(problem);
          return number ? `#${form}-question-${number}` : undefined;
        }}
      />
      {surveyId ? <input type="hidden" name="surveyId" value={surveyId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">உறுப்பினர்கள் காண்பவை</span> · What members see, in Tamil and English
        </legend>
        {PAIRS.map(({ pair, en, long, min, maxTa, maxEn, hint }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            <ActionField form={form} name={`${pair}Ta`} label={`${en}, in Tamil`} hint={hint} required state={state} targets={SURVEY_TARGETS}>
              {(control) =>
                long ? (
                  <textarea {...control} lang="ta" required minLength={min} maxLength={maxTa} rows={3} defaultValue={values[`${pair}Ta`]} className={TEXTAREA} />
                ) : (
                  <input {...control} lang="ta" required minLength={min} maxLength={maxTa} defaultValue={values[`${pair}Ta`]} className={CONTROL} />
                )
              }
            </ActionField>
            <ActionField form={form} name={`${pair}En`} label={`${en}, in English`} required state={state} targets={SURVEY_TARGETS}>
              {(control) =>
                long ? (
                  <textarea {...control} lang="en" required minLength={min} maxLength={maxEn} rows={3} defaultValue={values[`${pair}En`]} className={TEXTAREA} />
                ) : (
                  <input {...control} lang="en" required minLength={min} maxLength={maxEn} defaultValue={values[`${pair}En`]} className={CONTROL} />
                )
              }
            </ActionField>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">அமைப்புகள்</span> · Settings
        </legend>
        {fixedArea ? (
          <div className="flex flex-col gap-1">
            <input type="hidden" name="area" value={fixedArea} />
            <span className="text-sm font-semibold">
              <span lang="ta">பகுதி</span> / Area
            </span>
            <p className="text-sm text-text">{fixedAreaName ?? fixedArea}</p>
            <p className="text-xs text-muted">A survey keeps the area it was made for.</p>
          </div>
        ) : (
          <AreaPicker form={form} options={areaOptions} initial={state?.values.area || undefined} state={state} targets={SURVEY_TARGETS} />
        )}
        <ActionField
          form={form}
          name="closesAt"
          label="Closes (Sri Lankan time, optional)"
          hint="Leave empty to close it yourself."
          state={state}
          targets={SURVEY_TARGETS}>
          {(control) => <input {...control} type="datetime-local" defaultValue={values.closesAt} className={`${CONTROL} md:max-w-xs`} />}
        </ActionField>
        <PrivacyChoices form={form} state={state} anonymousAtStart={values.anonymous === '1'} editsAtStart={values.allowEdits === '1'} />
      </fieldset>

      <div className="border-t border-line pt-6">
        <QuestionBuilder form={form} initialJson={values.questionsJson ?? '[]'} state={state} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{editing ? 'Save draft' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">Members see the survey only once it is opened. After that it cannot change.</p>
      </div>
    </form>
  );
}

/**
 * FR-SRV-002: an anonymous survey stores answers with no link to the member, so nobody (not even
 * the member) can find their answer again to change it; allowing edits needs identified answers.
 */
function PrivacyChoices({ form, state, anonymousAtStart, editsAtStart }: { form: string; state: FormState; anonymousAtStart: boolean; editsAtStart: boolean }) {
  const [anonymous, setAnonymous] = useState(anonymousAtStart);
  const [allowEdits, setAllowEdits] = useState(editsAtStart && !anonymousAtStart);
  const errors = problemsFor(state, SURVEY_TARGETS, 'allowEdits');
  return (
    <fieldset id={fieldId(form, 'allowEdits')} tabIndex={-1} className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">Answers</legend>
      <CheckRow
        name="anonymous"
        label="Anonymous"
        hint="Answers are stored with no link to the member. An anonymous survey cannot allow edits."
        checked={anonymous}
        onChange={(checked) => {
          setAnonymous(checked);
          if (checked) setAllowEdits(false);
        }}
      />
      <CheckRow
        name="allowEdits"
        label="Members may change their answer while it is open"
        hint={anonymous ? 'Not possible for an anonymous survey.' : 'Answers are kept with the member so they can change them.'}
        checked={allowEdits}
        disabled={anonymous}
        onChange={setAllowEdits}
      />
      <FieldErrors id={errors.length ? `${form}-allowEdits-error` : undefined} problems={errors} />
    </fieldset>
  );
}
