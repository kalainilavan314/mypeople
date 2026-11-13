'use client';

import { useActionState } from 'react';

import { useLocale } from '@/lib/i18n/context';
import { bilingualMessageFor } from '@/lib/messages';

import { showReporterContact, type ContactState } from './actions';
import { CaseSubmit } from './fields';

/**
 * PRM-13: the case owner may look up the reporter's contact to follow up. The API records every
 * look in the audit log; the contact is shown here only, never kept in the address or the page.
 */
export function ReporterContact({ caseId }: { caseId: string }) {
  const locale = useLocale();
  const [state, action] = useActionState<ContactState, FormData>(showReporterContact, null);

  if (state && 'contact' in state) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-sm" aria-live="polite">
        <dl className="grid gap-2">
          <div>
            <dt className="text-xs text-muted">Reporter</dt>
            <dd className="font-semibold text-text">{state.contact.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Phone</dt>
            <dd className="font-mono text-text">{state.contact.phone ?? 'No phone number on record'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Member ID</dt>
            <dd className="font-mono text-text">{state.contact.memberCode}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">This look was recorded in the audit log.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <p id="contact-audit" className="text-xs text-muted">
        Only the case owner can see this. Every look is recorded in the audit log.
      </p>
      {state && 'error' in state ? (
        <p role="alert" lang={locale} className="text-xs font-semibold text-error">
          ! {locale === 'ta' ? bilingualMessageFor(state.error).ta : bilingualMessageFor(state.error).en}
        </p>
      ) : null}
      <CaseSubmit tone="secondary" describedBy="contact-audit">
        Show reporter contact
      </CaseSubmit>
    </form>
  );
}
