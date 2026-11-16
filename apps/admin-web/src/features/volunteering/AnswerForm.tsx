'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import type { FormState } from '@/lib/formState';

import { answerContact } from './actions';
import { VOLUNTEER_TARGETS } from './forms';

/** The coordinator's answer to a volunteer's message or change request; the volunteer is told. */
export function AnswerForm({ contactId, changeRequest }: { contactId: string; changeRequest: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(answerContact, null);
  const form = `answer-${contactId.slice(0, 8)}`;
  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
      <ActionProblems form={form} state={state} targets={VOLUNTEER_TARGETS} fields={['answer']} />
      <input type="hidden" name="contactId" value={contactId} />
      <ActionField
        form={form}
        name="answer"
        label="Your answer"
        hint={changeRequest ? 'Say what changes, or why it cannot. The assignment itself stays confirmed.' : undefined}
        required
        state={state}
        targets={VOLUNTEER_TARGETS}>
        {(control) => <textarea {...control} required minLength={3} maxLength={1000} rows={3} defaultValue={state?.values.answer} className={TEXTAREA} />}
      </ActionField>
      <ActionSubmit>Send answer</ActionSubmit>
    </form>
  );
}
