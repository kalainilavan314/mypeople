'use client';

import { useEffect, useRef } from 'react';

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
 * Always renders Tamil first, English supporting directly below (Priority 2).
 */
export function Feedback({ error, problems, done }: Props) {
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
    return (
      <div
        ref={alertRef}
        id="error-summary"
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
        className="flex flex-col gap-2 rounded-xl border border-error bg-error-bg px-4 py-3 text-sm text-error outline-none focus:ring-2 focus:ring-error">
        <div className="flex flex-col gap-0.5">
          <p lang="ta" className="font-semibold">
            ! {msg.ta}
          </p>
          <p lang="en" className="text-xs opacity-90">
            {msg.en}
          </p>
        </div>
        {list.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs">
            {list.map((problem) => {
              const p = bilingualProblemText(problem);
              const fieldTarget = problemTargetField(problem);
              return (
                <li key={problem} className="flex flex-col gap-0.5">
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
                      <span lang="ta" className="font-semibold">
                        {p.ta}
                      </span>
                      <span lang="en" className="block opacity-90">
                        {p.en}
                      </span>
                    </a>
                  ) : (
                    <>
                      <span lang="ta" className="font-semibold">
                        {p.ta}
                      </span>
                      <span lang="en" className="opacity-80">
                        {p.en}
                      </span>
                    </>
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
    return (
      <div role="status" className="flex flex-col gap-0.5 rounded-xl border border-success bg-success-bg px-4 py-3 text-sm text-success">
        <p lang="ta" className="font-semibold">
          ✓ {conf.ta}
        </p>
        <p lang="en" className="text-xs opacity-90">
          {conf.en}
        </p>
      </div>
    );
  }

  return null;
}
