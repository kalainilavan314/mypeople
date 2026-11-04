'use client';

import { useActionState } from 'react';

import { useLocale } from '@/lib/i18n/context';
import { bilingualMessageFor } from '@/lib/messages';

import { startEnrolment, type Enrolment as EnrolmentState } from './actions';

/** Shows the new authenticator secret and its QR code, kept only in this page's memory. */
export function Enrolment() {
  const locale = useLocale();
  const [state, start, pending] = useActionState<EnrolmentState, FormData>(startEnrolment, null);

  if (state && 'secret' in state) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-card p-4">
        {/* The SVG comes from the qrcode library on the server, as a data URL, never as markup; next/image
            would add nothing for an inline data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(state.qrSvg)}`}
          alt={locale === 'ta' ? 'அங்கீகார அமைவுக் குறியீடு' : 'Authenticator set-up code'}
          width={220}
          height={220}
        />
        <p className="flex flex-col items-center">
          <span lang={locale} className="text-sm font-semibold text-text">
            {locale === 'ta' ? 'இரகசிய விசை' : 'Secret key'}
          </span>
        </p>
        <p className="select-all break-all font-mono text-base">{state.secret}</p>
      </div>
    );
  }
  return (
    <form action={start} className="flex flex-col gap-2">
      {state && 'error' in state ? (
        <p role="alert" className="text-sm text-error">
          ! {locale === 'ta' ? bilingualMessageFor(state.error).ta : bilingualMessageFor(state.error).en}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60">
        <span lang={locale}>
          {locale === 'ta'
            ? pending
              ? 'செயற்படுகிறது…'
              : 'அங்கீகாரச் செயலியை அமைத்தல்'
            : pending
              ? 'Working…'
              : 'Set up an authenticator'}
        </span>
      </button>
    </form>
  );
}
