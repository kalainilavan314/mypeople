'use client';

import { useActionState } from 'react';

import { ActionCard, ActionProblems, ActionSubmit } from '@/components/ActionForm';
import type { FormState } from '@/lib/formState';

import { moveSurvey } from './actions';
import { SURVEY_TARGETS, questionNumberOf } from './forms';

/** Open a draft (its questions are checked first) or close an open survey. Neither can be undone. */
export function SurveyStateForm({ surveyId, state: current }: { surveyId: string; state: 'draft' | 'open' | 'closed' }) {
  const [state, action] = useActionState<FormState, FormData>(moveSurvey, null);
  if (current === 'closed') return <p className="text-sm text-muted">A closed survey cannot open again.</p>;
  const opening = current === 'draft';
  return (
    <ActionCard
      id="survey-state"
      title={opening ? 'Open the survey' : 'Close the survey'}
      intro={
        opening
          ? 'Members in the area can answer once it opens. It cannot be changed after that, so check the questions first.'
          : 'No more answers are taken. A closed survey cannot open again.'
      }>
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3">
        <ActionProblems
          form="survey-state"
          state={state}
          targets={SURVEY_TARGETS}
          fields={[]}
          linkFor={(problem) => {
            const number = questionNumberOf(problem);
            return number ? `#edit-question-${number}` : problem === 'questions_required' ? '#edit-questions' : undefined;
          }}
        />
        <input type="hidden" name="surveyId" value={surveyId} />
        <input type="hidden" name="state" value={opening ? 'open' : 'closed'} />
        <ActionSubmit tone={opening ? 'primary' : 'secondary'}>{opening ? 'Open to members' : 'Close the survey'}</ActionSubmit>
      </form>
    </ActionCard>
  );
}
