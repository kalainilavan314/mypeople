import type { MembershipFile } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { changeMembership } from '@/features/members/actions';
import { formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage, getLocalizedProblem } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const CHANGES: Record<string, { from: string[]; reasons: string[] }> = {
  activate: { from: ['pending', 'inactive'], reasons: ['identity_verified', 'rejoined', 'other'] },
  suspend: { from: ['active'], reasons: ['conduct_investigation', 'security_concern', 'member_request', 'other'] },
  reinstate: { from: ['suspended'], reasons: ['investigation_closed', 'appeal_upheld', 'member_request', 'other'] },
  inactivate: { from: ['pending', 'active', 'suspended'], reasons: ['member_request', 'deceased', 'duplicate_account', 'other'] },
};

const ACTION_LABELS: Record<string, { ta: string; en: string }> = {
  activate: { ta: 'செயற்படுத்துக', en: 'Activate' },
  suspend: { ta: 'இடைநிறுத்துக', en: 'Suspend' },
  reinstate: { ta: 'மீளமைக்க', en: 'Reinstate' },
  inactivate: { ta: 'முடக்குக', en: 'Inactivate' },
};

const REASON_LABELS: Record<string, { ta: string; en: string }> = {
  identity_verified: { ta: 'அடையாளம் உறுதிசெய்யப்பட்டது', en: 'Identity verified' },
  rejoined: { ta: 'மீண்டும் இணைந்தார்', en: 'Rejoined party' },
  conduct_investigation: { ta: 'ஒழுக்காற்று விசாரணை', en: 'Conduct investigation' },
  security_concern: { ta: 'பாதுகாப்புக் கரிசனை', en: 'Security concern' },
  member_request: { ta: 'உறுப்பினரின் கோரிக்கை', en: 'Member request' },
  investigation_closed: { ta: 'விசாரணை நிறைவடைந்தது', en: 'Investigation closed' },
  appeal_upheld: { ta: 'மேன்முறையீடு ஏற்கப்பட்டது', en: 'Appeal upheld' },
  deceased: { ta: 'காலமானார்', en: 'Deceased' },
  duplicate_account: { ta: 'இரட்டைக் கணக்கு', en: 'Duplicate account' },
  other: { ta: 'ஏனையவை', en: 'Other' },
};

/** Member status console: review state, audit history, and permitted lifecycle transitions. */
export default function MembershipFilePage(props: PageProps<'/membership/[memberId]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading</p>}>
      <FileView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function FileView({ params, searchParams }: Pick<PageProps<'/membership/[memberId]'>, 'params' | 'searchParams'>) {
  const staff = await requireStaff();
  const { memberId } = await params;
  const query = await searchParams;
  const locale = await getAdminLocale(staff.member.language);
  let file: MembershipFile;
  try {
    file = await (await staffApi()).getMembership(memberId);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  const allowed = Object.entries(CHANGES).filter(([, change]) => change.from.includes(file.state));
  const problems = (one(query.problems) ?? '').split(',');
  const hasProblem = (p: string) => problems.includes(p);

  return (
    <>
      <PageHeader ta="உறுப்புரிமைக் கோப்பு" en="Membership file">
        <Link href="/membership" className="text-sm text-primary underline">
          <span lang={locale}>{locale === 'ta' ? 'உறுப்பினர் பட்டியலுக்குத் திரும்புக' : 'Back to member list'}</span>
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 text-sm" aria-label="Membership status">
        <div>
          <span lang={locale} className="block text-xs font-semibold text-muted">
            {locale === 'ta' ? 'தற்போதைய உறுப்புரிமை நிலை' : 'Current membership state'}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StateTag state={file.state} />
            {file.reasonCode ? <span className="font-medium text-text">· {REASON_LABELS[file.reasonCode]?.[locale] ?? words(file.reasonCode)}</span> : ''}
            <span className="text-muted">· {locale === 'ta' ? 'மாற்றப்பட்ட திகதி:' : 'Changed:'} {formatDateTime(file.changedAt)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 text-xs">
          <span lang={locale} className="block text-xs font-semibold text-muted">
            {locale === 'ta' ? 'அடையாளச் சரிபார்ப்பு நிலை' : 'Identity verification status'}
          </span>
          <p className="mt-1 font-semibold text-text">
            {file.identityVerified ? (
              <span className="text-success"><span lang={locale}>{locale === 'ta' ? 'அடையாளம் உறுதிசெய்யப்பட்டது' : 'Identity verified'}</span></span>
            ) : (
              <span className="text-error"><span lang={locale}>! {locale === 'ta' ? 'அடையாளம் உறுதிசெய்யப்படவில்லை (செயற்படுத்தலுக்கு சரிபார்க்கப்பட்ட அடையாளம் தேவை)' : 'Not verified (activation requires a verified identity)'}</span></span>
            )}
          </p>
        </div>
      </section>

      {allowed.length > 0 ? (
        <form action={changeMembership} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <input type="hidden" name="memberId" value={memberId} />
          <div>
            <h2 className="text-base font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'உறுப்புரிமை நிலை மாற்றம்' : 'Record state transition'}</span>
            </h2>
          </div>

          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            <span lang={locale} className="text-xs">
              {locale === 'ta' ? 'நிலை மாற்றம் மற்றும் காரணம் *' : 'Change and reason *'}
            </span>
            <select
              id="input-change"
              name="change"
              required
              defaultValue=""
              className="min-h-11 rounded-lg border border-line px-2 font-normal">
              <option value="" disabled>
                {locale === 'ta' ? 'தெரிவுசெய்க…' : 'Choose…'}
              </option>
              {allowed.map(([action, change]) => (
                <optgroup key={action} label={ACTION_LABELS[action]?.[locale] ?? action}>
                  {change.reasons.map((reason) => (
                    <option key={reason} value={`${action}:${reason}`}>
                      {ACTION_LABELS[action]?.[locale] ?? action}: {REASON_LABELS[reason]?.[locale] ?? words(reason)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            <span lang={locale} className="text-xs">
              {locale === 'ta' ? 'விளக்கக் குறிப்பு (“ஏனையவை” காரணத்திற்கு அவசியமானது)' : 'Note (needed for “other”)'}
            </span>
            <textarea
              id="input-note"
              name="note"
              maxLength={500}
              rows={2}
              aria-invalid={hasProblem('note_required') ? 'true' : undefined}
              aria-describedby={hasProblem('note_required') ? 'field-error-note' : undefined}
              className="rounded-lg border border-line p-2 text-base font-normal"
            />
          </label>
          {hasProblem('note_required') ? (
            <p id="field-error-note" role="alert" className="text-xs font-semibold text-error">
              ! {getLocalizedProblem('note_required', locale)}
            </p>
          ) : null}

          <div className="rounded-lg border border-line bg-surface p-3 text-xs text-muted">
            <p className="font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'நிலை மாற்ற அறிவிப்பு' : 'Status transition notice'}</span>
            </p>
            <p className="mt-1">
              <span lang={locale} className="block text-text font-medium">
                {locale === 'ta'
                  ? 'செயற்படுத்தல் மூலம் வாக்களிக்கும் உரிமை, உத்தியோகபூர்வ எண்ணிம உறுப்பினர் அட்டை மற்றும் நிகழ்வுப் பதிவு உரிமைகள் கிடைக்கின்றன. இடைநிறுத்தல் அல்லது முடக்குதல் மூலம் அனைத்து உள்சேவைகளும் பணியாளர் பொறுப்புகளும் முடக்கப்படும்; இவை தணிக்கைப் பதிவேட்டில் நிரந்தரமாகப் பதிவுசெய்யப்படும்.'
                  : 'Activation enables civic rights, official digital membership credentials, and event registration. Suspension or inactivation revokes access to internal services, freezes any held staff assignments, and is recorded in the permanent audit trail.'}
              </span>
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs font-medium text-muted">
            <input
              type="checkbox"
              id="input-confirm"
              name="confirmMembershipChange"
              value="1"
              required
              aria-invalid={hasProblem('confirmation_required') ? 'true' : undefined}
              aria-describedby={hasProblem('confirmation_required') ? 'field-error-confirm' : undefined}
              className="mt-0.5 rounded border-line"
            />
            <span lang={locale} className="font-semibold text-text">
              {locale === 'ta'
                ? 'இந்த நிலை மாற்றமும் அதன் காரணமும் சரியானவை என உறுதிப்படுத்துகிறேன்.'
                : 'I confirm that this status change and justification are accurate and verified against party records.'}
            </span>
          </label>
          {hasProblem('confirmation_required') ? (
            <p id="field-error-confirm" role="alert" className="text-xs font-semibold text-error">
              ! {getLocalizedProblem('confirmation_required', locale)}
            </p>
          ) : null}

          <div>
            <SubmitButton>
              <span lang={locale}>{locale === 'ta' ? 'மாற்றத்தைப் பதிவுசெய்க' : 'Record the change'}</span>
            </SubmitButton>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
          <p lang={locale} className="font-semibold text-text">
            {locale === 'ta'
              ? 'இந்த நிலைக்கு அனுமதிக்கப்பட்ட மேலதிக மாற்றங்கள் எதுவும் இல்லை.'
              : 'No further state transitions allowed for this membership state.'}
          </p>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? 'உறுப்புரிமை நிலை வரலாற்றுப் பதிவேடு' : 'State transition history'}</span>
          </h2>
        </div>
        {file.history.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
            <p lang={locale} className="font-semibold text-text">
              {locale === 'ta'
                ? 'இன்னும் மாற்றங்கள் எதுவும் இல்லை: பதிவுசெய்ததிலிருந்து நிலுவையில் உள்ளது.'
                : 'No changes yet: pending since sign-up.'}
            </p>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {file.history.map((change) => (
            <li key={change.changedAt} className="rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold text-text">
                {ACTION_LABELS[change.action]?.[locale] ?? words(change.action)}: {change.fromState} → {change.toState}
              </p>
              <p className="text-xs text-muted">
                {locale === 'ta' ? 'காரணம்:' : 'Reason:'} {REASON_LABELS[change.reasonCode]?.[locale] ?? words(change.reasonCode)} · {formatDateTime(change.changedAt)}
              </p>
              {change.note ? <p className="mt-1 rounded bg-surface p-2 text-xs text-muted">{change.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
