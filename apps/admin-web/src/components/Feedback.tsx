'use client';

import { useEffect, useRef } from 'react';

import { useLocale } from '@/lib/i18n/context';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText, problemTargetField } from '@/lib/messages';

type Props = {
  error?: string | string[];
  problems?: string | string[];
  done?: string | string[];
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The result of the last action, carried back in the address after the
 * action redirected: a refusal with its reasons, or a confirmation. Only
 * codes travel in the address, never personal data.
 * Renders in the active language cleanly (Milestone 1).
 */
export function Feedback({ error, problems, done }: Props) {
  const locale = useLocale();
  const alertRef = useRef<HTMLDivElement>(null);
  const code = first(error);
  const list = (first(problems) ?? '').split(',').filter(Boolean);
  const confirmation = first(done);

  useEffect(() => {
    if (code && alertRef.current) {
      alertRef.current.focus();
    }
  }, [code]);

  if (code) {
    const msg = bilingualMessageFor(code);
    const messageText = locale === 'ta' ? msg.ta : msg.en;

    return (
      <div
        ref={alertRef}
        id="error-summary"
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
        className="flex flex-col gap-2 rounded-xl border border-error bg-error-bg px-4 py-3 text-sm text-error outline-none focus:ring-2 focus:ring-error">
        <p lang={locale} className="font-semibold">
          ! {messageText}
        </p>

        {list.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs">
            {list.map((problem) => {
              const p = bilingualProblemText(problem);
              const problemText = locale === 'ta' ? p.ta : p.en;
              const fieldTarget = problemTargetField(problem);

              return (
                <li key={problem}>
                  {fieldTarget ? (
                    <a
                      href={`#input-${fieldTarget}`}
                      className="underline hover:opacity-100 focus:rounded focus:outline-none focus:ring-1 focus:ring-error"
                      onClick={(e) => {
                        const target = document.getElementById(`input-${fieldTarget}`);
                        if (target) {
                          e.preventDefault();
                          target.focus();
                          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}>
                      <span lang={locale} className="font-semibold">
                        {problemText}
                      </span>
                    </a>
                  ) : (
                    <span lang={locale} className="font-semibold">
                      {problemText}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  if (confirmation) {
    const conf = bilingualConfirmation(confirmation);
    const confText = locale === 'ta' ? conf.ta : conf.en;

    return (
      <div role="status" className="flex flex-col gap-0.5 rounded-xl border border-success bg-success-bg px-4 py-3 text-sm text-success">
        <p lang={locale} className="font-semibold">
          ✓ {confText}
        </p>
      </div>
    );
  }

  return null;
}
