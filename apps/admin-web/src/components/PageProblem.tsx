import { ApiError } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { getDictionary, getLocalizedMessage, type Locale } from '@/lib/i18n';

type ProblemProps = { locale: Locale; message: string; detail?: string | null };

/** A page that cannot show its records says why, in words and with a "!" mark, never by colour alone. */
export function PageProblem({ locale, message, detail }: ProblemProps) {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-xl border border-error bg-error-bg px-4 py-3 text-sm text-error">
      <p lang={locale} className="font-semibold">
        ! {message}
      </p>
      {detail ? (
        <p lang={locale} className="text-xs">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

type FailureProps = {
  error: unknown;
  locale: Locale;
  /** What the screen needs, said when the API answers "forbidden". */
  refused: string;
  notFound: string;
};

/**
 * Why a read failed: the session ended, the person lacks the permission or the area, the record
 * does not exist, or the API could not answer. Only the API's error code is shown, never its body.
 */
export function LoadFailure({ error, locale, refused, notFound }: FailureProps) {
  if (error instanceof ApiError && error.status === 401) redirect('/sign-in?ended=1');
  if (error instanceof ApiError && error.status === 403) {
    // "forbidden" is the missing permission; other codes (outside_your_area) say more than that.
    const message = error.code === 'forbidden' ? refused : getLocalizedMessage(error.code, locale);
    return <PageProblem locale={locale} message={message} />;
  }
  if (error instanceof ApiError && error.status === 404) return <PageProblem locale={locale} message={notFound} />;
  const detail = error instanceof ApiError ? getLocalizedMessage(error.code, locale) : null;
  return <PageProblem locale={locale} message={getDictionary(locale).common.loadFailed} detail={detail} />;
}
