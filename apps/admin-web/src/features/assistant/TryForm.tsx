'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { BilingualTag } from '@/components/BilingualTag';
import { CONTROL } from '@/components/FormField';

import { tryQuestion, type TryState } from './actions';
import { AnswerView } from './AnswerView';
import { MODEL_STATUS_LABELS, OUTCOME_LABELS, OUTCOME_TONES, REDACTION_LABELS, REFUSAL_LABELS, SOURCE_TARGETS, UNAVAILABLE_WORDS } from './forms';

/**
 * Try a question against the approved sources with the model the server is set up to call, even in
 * shadow mode, before members see it. Logged as a staff preview; nothing else is kept.
 */
export function TryForm() {
  const [state, action] = useActionState<TryState, FormData>(tryQuestion, null);
  const preview = state?.preview ?? null;
  const unavailable = state?.form?.error === 'assistant_unavailable' ? state.form.problems[0] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form key={state?.form?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        {unavailable && UNAVAILABLE_WORDS[unavailable] ? (
          <p role="alert" className="flex flex-col gap-1 rounded-xl border border-warning bg-warning-bg px-4 py-3 text-sm text-warning">
            <span lang="ta">{UNAVAILABLE_WORDS[unavailable].ta}</span>
            <span lang="en">{UNAVAILABLE_WORDS[unavailable].en}</span>
          </p>
        ) : (
          <ActionProblems form="try" state={state?.form ?? null} targets={SOURCE_TARGETS} fields={['question']} />
        )}
        <ActionField form="try" name="question" label="Question" hint="Ask as a member would, in Tamil or English. Identifiers such as NIC or phone numbers are removed first." required state={state?.form ?? null} targets={SOURCE_TARGETS}>
          {(control) => <textarea {...control} required maxLength={1000} rows={3} defaultValue={state?.question ?? ''} className={TEXTAREA} />}
        </ActionField>
        <ActionField form="try" name="language" label="Answer in" state={state?.form ?? null} targets={SOURCE_TARGETS}>
          {(control) => (
            <select {...control} defaultValue={state?.language ?? 'ta'} className={`${CONTROL} md:w-64`}>
              <option value="ta">தமிழ் · Tamil</option>
              <option value="en">English</option>
            </select>
          )}
        </ActionField>
        <ActionSubmit>Try the question</ActionSubmit>
      </form>

      {preview ? (
        <section aria-label="Preview answer" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <p className="flex flex-wrap items-center gap-2">
            <BilingualTag label={OUTCOME_LABELS[preview.outcome]} tone={OUTCOME_TONES[preview.outcome]} />
            {preview.refusal ? <BilingualTag label={REFUSAL_LABELS[preview.refusal] ?? { ta: preview.refusal, en: preview.refusal }} tone="waiting" /> : null}
            <BilingualTag label={MODEL_STATUS_LABELS[preview.modelStatus]} tone={preview.modelStatus === 'live' ? 'done' : 'waiting'} />
            <span className="text-xs text-muted">{preview.modelName}</span>
          </p>
          {preview.redactions.length > 0 ? (
            <p className="text-xs text-muted">
              Removed before anything was sent: {preview.redactions.map((kind) => REDACTION_LABELS[kind]?.en ?? kind).join(', ')}.
            </p>
          ) : null}
          {!preview.modelCalled ? (
            <p className="text-xs text-muted">No approved passage matched the question, so no model was asked. Members are offered a person.</p>
          ) : null}
          {preview.topics.includes('eligibility') ? (
            <p className="text-xs text-muted">Members also see a link to Community Support for eligibility questions.</p>
          ) : null}
          <AnswerView body={preview.body} citations={preview.citations} />
        </section>
      ) : null}
    </div>
  );
}
