import type { ScanException } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { SubmitButton } from '@/components/SubmitButton';
import { decideOfflineScan } from '@/features/events/actions';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'events.manage';
const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const WORDS = {
  ta: {
    title: 'இணைப்பற்ற ஸ்கேன்கள்',
    intro: 'இணைப்பு இல்லாதபோது பணியாளர் தொலைபேசி பதிவுசெய்த ஸ்கேன்களில் இவற்றைச் சேவையகம் தானாகத் தீர்மானிக்க முடியவில்லை. ஸ்கேன் செய்தவர் அல்லாத ஒருவர் காரணத்துடன் தீர்மானிக்க வேண்டும்; ஏற்றுக்கொள்வதற்கு அந்நேரத்தில் செல்லுபடியான அனுமதிச்சீட்டு தேவை.',
    empty: 'மீளாய்வுக்குக் காத்திருக்கும் ஸ்கேன் எதுவும் இல்லை.',
    scannedAt: 'தொலைபேசியில் பதிவான நேரம்',
    receivedAt: 'சேவையகம் பெற்ற நேரம்',
    why: 'காத்திருப்பதற்கான காரணம்',
    clock_ahead: 'தொலைபேசியின் கடிகாரம் சேவையகத்தை விட முன்னால் இருந்தது',
    too_old: '72 மணி நேரத்துக்கு மேல் பழையது',
    decision: 'தீர்மானம்',
    accept: 'ஏற்றுக்கொள் (வருகையைப் பதிவுசெய்)',
    reject: 'மறு',
    reason: 'காரணம் (ஸ்கேன் செய்தவருக்கும் தணிக்கைப் பதிவுக்கும்)',
    submit: 'தீர்மானத்தைப் பதிவுசெய்',
    back: 'நிகழ்வுக்குத் திரும்பு',
    refused: 'இப்பக்கத்துக்கு நிகழ்வு நிர்வாக அனுமதி தேவை.',
    notFound: 'இந்த நிகழ்வு கிடைக்கவில்லை.',
    scan_accepted: 'ஸ்கேன் ஏற்றுக்கொள்ளப்பட்டது; வருகை பதிவானது.',
    scan_rejected: 'ஸ்கேன் மறுக்கப்பட்டது.',
  },
  en: {
    title: 'Offline scans',
    intro: 'Scans a staff phone recorded without a connection that the server could not settle on its own. Someone other than the scanner decides each one with a reason; accepting still needs a pass that was genuine at the recorded time.',
    empty: 'No scans are waiting for review.',
    scannedAt: 'Recorded on the phone',
    receivedAt: 'Reached the server',
    why: 'Why it waits',
    clock_ahead: 'The phone’s clock was ahead of the server’s',
    too_old: 'Older than 72 hours',
    decision: 'Decision',
    accept: 'Accept (record attendance)',
    reject: 'Reject',
    reason: 'Reason (kept in the audit log)',
    submit: 'Record decision',
    back: 'Back to the event',
    refused: 'You need the event management permission for this page.',
    notFound: 'This event was not found.',
    scan_accepted: 'Scan accepted; attendance recorded.',
    scan_rejected: 'Scan rejected.',
  },
} as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** MP-DEC-001 4.5: queued offline scans that wait for a person, settled with a reason. */
export default function OfflineScansPage(props: PageProps<'/events/[id]/offline-scans'>) {
  return (
    <>
      <PageHeader ta={WORDS.ta.title} en={WORDS.en.title} />
      <Suspense fallback={<ConsoleLoading />}>
        <OfflineScans params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function OfflineScans({ params, searchParams }: Pick<PageProps<'/events/[id]/offline-scans'>, 'params' | 'searchParams'>) {
  await connection(); // API_URL may be set only on the running server
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const words = WORDS[locale === 'ta' ? 'ta' : 'en'];
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;
  const { id } = await params;
  if (!UUID.test(id)) return <PageProblem locale={locale} message={words.notFound} />;
  const query = await searchParams;
  const error = one(query.error);
  const done = one(query.done);

  let waiting: ScanException[];
  try {
    waiting = await (await staffApi()).listScanExceptions(id);
  } catch (failure) {
    return <LoadFailure error={failure} locale={locale} refused={words.refused} notFound={words.notFound} />;
  }

  return (
    <>
      <p lang={locale} className="text-sm text-muted">
        {words.intro}
      </p>
      {done === 'scan_accepted' || done === 'scan_rejected' ? (
        <p role="status" lang={locale} className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold">
          {words[done]}
        </p>
      ) : null}
      {error ? (
        <p role="alert" lang={locale} className="rounded-xl border border-error bg-error-bg px-4 py-3 text-sm font-semibold text-error">
          {getLocalizedMessage(error, locale)}
        </p>
      ) : null}

      {waiting.length === 0 ? (
        <p lang={locale} className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          {words.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {waiting.map((scan) => (
            <li key={scan.scanEventId} className="rounded-xl border border-line bg-card p-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt lang={locale} className="text-muted">{words.scannedAt}</dt>
                  <dd>{formatDateTime(scan.clientScanAt)}</dd>
                </div>
                <div>
                  <dt lang={locale} className="text-muted">{words.receivedAt}</dt>
                  <dd>{formatDateTime(scan.serverReceivedAt)}</dd>
                </div>
                <div>
                  <dt lang={locale} className="text-muted">{words.why}</dt>
                  <dd lang={locale}>{scan.reason === 'clock_ahead' || scan.reason === 'too_old' ? words[scan.reason] : scan.reason}</dd>
                </div>
              </dl>
              <form action={decideOfflineScan} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="scanId" value={scan.scanEventId} />
                <fieldset className="flex flex-wrap gap-4">
                  <legend lang={locale} className="mb-1 text-sm font-semibold">{words.decision}</legend>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="radio" name="decision" value="accepted" required className={FOCUS} />
                    <span lang={locale}>{words.accept}</span>
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="radio" name="decision" value="rejected" required className={FOCUS} />
                    <span lang={locale}>{words.reject}</span>
                  </label>
                </fieldset>
                <label htmlFor={`reason-${scan.scanEventId}`} lang={locale} className="text-sm font-semibold">
                  {words.reason}
                </label>
                <textarea
                  id={`reason-${scan.scanEventId}`}
                  name="reason"
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={2}
                  className={`rounded-lg border border-line bg-card px-3 py-2 text-sm ${FOCUS}`}
                />
                <SubmitButton>
                  <span lang={locale}>{words.submit}</span>
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Link href={`/events/${id}`} className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
        <span lang={locale}>{words.back}</span>
      </Link>
    </>
  );
}
