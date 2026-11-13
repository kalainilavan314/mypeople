'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import { PROPOSAL_TARGETS } from '@/features/development/forms';
import type { FormState } from '@/lib/formState';
import { useLocale } from '@/lib/i18n/context';

import { moderateIdea, moderateProposal } from './actions';
import { EDITED_BENEFIT, EDITED_TITLE, IDEA_TARGETS } from './ideaEdits';

/**
 * Publish an idea or a proposal, or reject it with the reason its author is told. The reason is
 * needed only to reject, so the browser does not block publishing; the form says when it is missing.
 * An idea may be published in an edited (redacted) version (D12): its author still sees their own
 * words, with a note that a moderator edited what others see.
 */
export function ModerationForm({ kind, itemId }: { kind: 'idea' | 'proposal'; itemId: string }) {
  const [state, action] = useActionState<FormState, FormData>(kind === 'idea' ? moderateIdea : moderateProposal, null);
  const ta = useLocale() === 'ta';
  const form = `${kind}-${itemId.slice(0, 8)}`;
  const targets = kind === 'idea' ? IDEA_TARGETS : PROPOSAL_TARGETS;
  const edited = Boolean(state?.values.editedTitle || state?.values.editedBenefit);
  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
      <ActionProblems
        form={form}
        state={state}
        targets={targets}
        fields={kind === 'idea' ? ['reason', 'editedTitle', 'editedBenefit'] : ['reason']}
      />
      <input type="hidden" name="itemId" value={itemId} />
      <ActionField
        form={form}
        name="reason"
        label={ta ? 'காரணம் (நிராகரிக்கத் தேவை), எழுதியவருக்கு அனுப்பப்படும்' : 'Reason (needed to reject), sent to the author'}
        state={state}
        targets={targets}>
        {(control) => <textarea {...control} maxLength={kind === 'idea' ? 500 : 2000} rows={2} defaultValue={state?.values.reason} className={TEXTAREA} />}
      </ActionField>
      {kind === 'idea' ? (
        <details open={edited} className="rounded-md border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold" lang={ta ? 'ta' : 'en'}>
            {ta ? 'திருத்திய பதிப்பை வெளியிடு (விரும்பினால்)' : 'Publish an edited version (optional)'}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-xs text-muted" lang={ta ? 'ta' : 'en'}>
              {ta
                ? 'உதாரணமாக, ஒரு தனிநபரின் பெயரை நீக்க. ஏனைய உறுப்பினர்கள் திருத்திய பதிப்பை மட்டுமே பார்ப்பர்; எழுதியவர் தன் சொந்த உரையைப் பார்ப்பார், நெறிப்படுத்துநர் திருத்தினார் என்றும் அறிவார்.'
                : 'For example, to remove a private person’s name. Other members see only the edited version; the author keeps their own words and is told a moderator edited it.'}
            </p>
            <ActionField
              form={form}
              name="editedTitle"
              label={ta ? 'திருத்திய தலைப்பு' : 'Edited title'}
              hint={
                ta
                  ? `${EDITED_TITLE.min} முதல் ${EDITED_TITLE.max} எழுத்துகள். எழுதியவரின் தலைப்பை வைத்திருக்க வெறுமையாக விடவும்.`
                  : `${EDITED_TITLE.min} to ${EDITED_TITLE.max} characters. Leave empty to keep the author’s title.`
              }
              state={state}
              targets={targets}>
              {(control) => (
                <input {...control} type="text" maxLength={EDITED_TITLE.max} defaultValue={state?.values.editedTitle} className={CONTROL} />
              )}
            </ActionField>
            <ActionField
              form={form}
              name="editedBenefit"
              label={ta ? 'திருத்திய பயன்' : 'Edited benefit'}
              hint={
                ta
                  ? `${EDITED_BENEFIT.min} முதல் ${EDITED_BENEFIT.max} எழுத்துகள். எழுதியவரின் உரையை வைத்திருக்க வெறுமையாக விடவும்.`
                  : `${EDITED_BENEFIT.min} to ${EDITED_BENEFIT.max} characters. Leave empty to keep the author’s text.`
              }
              state={state}
              targets={targets}>
              {(control) => (
                <textarea {...control} maxLength={EDITED_BENEFIT.max} rows={3} defaultValue={state?.values.editedBenefit} className={TEXTAREA} />
              )}
            </ActionField>
          </div>
        </details>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <ActionSubmit name="publish" value="1">
          {kind === 'idea' ? (ta ? 'யோசனையை வெளியிடு' : 'Publish idea') : ta ? 'மீளாய்வுக்கு வெளியிடு' : 'Publish for review'}
        </ActionSubmit>
        <ActionSubmit name="publish" value="0" tone="danger">
          {ta ? 'நிராகரி' : 'Reject'}
        </ActionSubmit>
      </div>
    </form>
  );
}
