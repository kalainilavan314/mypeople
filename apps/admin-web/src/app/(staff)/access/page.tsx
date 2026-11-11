import type { AccessCatalogue, AssignmentPreviewDetails, ListedAssignment } from '@my-people/api-client';
import { permissionName } from '@my-people/i18n/staff-terms';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { cancelAssignmentPreview, createAssignment, previewAssignment, revokeAssignment } from '@/features/organization/actions';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage, getLocalizedProblem, type Locale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const input = 'min-h-11 rounded-lg border border-line px-3 font-normal';
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const AREA_LEVEL_LABELS: Record<string, { ta: string; en: string }> = {
  gn: { ta: 'கிராம அலுவலர் பிரிவு', en: 'GN division' },
  ds: { ta: 'பிரதேச செயலகப் பிரிவு', en: 'DS division' },
  district: { ta: 'மாவட்டம்', en: 'District' },
  province: { ta: 'மாகாணம்', en: 'Province' },
  platform: { ta: 'தேசிய தளம் (அனைத்துப் பகுதிகள்)', en: 'Platform-wide' },
};

/**
 * Roles and access management: who holds which tier, area, and permissions
 * in the administrator's areas, and assigning or ending a role.
 */
export default function AccessPage(props: PageProps<'/access'>) {
  return (
    <>
      <PageHeader ta="பொறுப்புகள், பகுதிகள், அனுமதிகள்" en="Roles and access" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Access searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Access({ searchParams }: { searchParams: PageProps<'/access'>['searchParams'] }) {
  const query = await searchParams;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const api = await staffApi();
  let catalogue: AccessCatalogue;
  let assignments: ListedAssignment[];
  try {
    [catalogue, assignments] = await Promise.all([api.getAccessCatalogue(), api.listAssignments('active')]);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }

  const previewId = one(query.previewId);
  let preview: AssignmentPreviewDetails | null = null;
  let previewExpiredOrInvalid = false;
  if (previewId) {
    if (!UUID.test(previewId)) {
      previewExpiredOrInvalid = true;
    } else {
      try {
        preview = await api.getAssignmentPreview(previewId);
      } catch {
        previewExpiredOrInvalid = true;
      }
    }
  }

  const problems = (one(query.problems) ?? '').split(',');
  const hasProblem = (p: string) => problems.includes(p);
  const areaNames = await loadAreaNames([...assignments.map((assignment) => assignment.area), preview?.area]);
  const permissionList = (codes: readonly string[]) => codes.map((code) => permissionName(code, locale)).join(', ');

  return (
    <>
      <Feedback
        error={previewExpiredOrInvalid ? 'preview_expired_or_invalid' : query.error}
        problems={query.problems}
        done={query.done}
      />

      {preview ? (
        <section
          aria-labelledby="preview-heading"
          className="flex flex-col gap-4 rounded-xl border border-primary bg-surface p-4 text-sm">
          <div className="flex flex-col gap-0.5">
            <h2 id="preview-heading" className="text-base font-bold text-text">
              <span lang={locale}>
                {locale === 'ta' ? 'பணியாளர் பொறுப்பு ஒதுக்கீடு முன்மாதிரி' : 'Role Assignment Impact Preview'}
              </span>
            </h2>
          </div>

          <div className="grid gap-3 rounded-lg border border-line bg-card p-4 sm:grid-cols-2">
            <div>
              <span lang={locale} className="block text-xs font-semibold text-muted">
                {locale === 'ta' ? 'உறுப்பினர்' : 'Member'}
              </span>
              <p className="mt-1 font-semibold text-text">
                {preview.fullName}{' '}
                <span className="font-mono text-xs text-muted">({preview.memberCode})</span>
              </p>
            </div>

            <div>
              <span lang={locale} className="block text-xs font-semibold text-muted">
                {locale === 'ta' ? 'பொறுப்பு நிலை மற்றும் பகுதி' : 'Tier and assigned area'}
              </span>
              <p className="mt-1 font-semibold text-text">
                Tier {preview.tier} · <span lang={locale}>{areaText(preview.area, areaNames, locale)}</span>
              </p>
            </div>

            <div>
              <span lang={locale} className="block text-xs font-semibold text-muted">
                {locale === 'ta' ? 'அடுத்த காலாண்டு மீளாய்வுத் திகதி' : 'Next review due date'}
              </span>
              <p className="mt-1 font-semibold text-text">
                {preview.reviewDueAt ? formatDate(preview.reviewDueAt) : (locale === 'ta' ? 'அடுத்த காலாண்டு சுழற்சி' : 'Next quarterly cycle')}
              </p>
            </div>

            <div>
              <span lang={locale} className="block text-xs font-semibold text-muted">
                {locale === 'ta' ? `வழங்கப்படும் அனுமதிகள் (${preview.permissions.length})` : `Granted permissions (${preview.permissions.length})`}
              </span>
              <p lang={locale} className="mt-1 text-xs text-text">
                {permissionList(preview.permissions) || (locale === 'ta' ? 'அனுமதிகள் எதுவும் தெரிவுசெய்யப்படவில்லை' : 'None selected')}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span lang={locale} className="block text-xs font-semibold text-muted">
                {locale === 'ta' ? 'பொறுப்பின் தாக்கம்' : 'Effect of assignment'}
              </span>
              <div className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs">
                <span lang={locale} className="block font-medium text-text">
                  {locale === 'ta'
                    ? 'இந்த உறுப்பினர் தனது பகுதியில் தொடர்புடைய நிர்வாக மற்றும் சரிபார்ப்பு நடவடிக்கைகளை மேற்கொள்வார். பிற பொறுப்புகளுடன் முரண்பாடுகள் இல்லை என்பது உறுதிசெய்யப்பட்டுள்ளது.'
                    : 'This member will be authorized to carry out administrative and verification actions within their assigned area. Separation-of-duties rules have been validated.'}
                </span>
              </div>
            </div>
          </div>

          <form action={createAssignment} className="flex flex-col gap-3">
            <input type="hidden" name="previewId" value={preview.id} />
            <label className="flex items-start gap-2 text-xs font-medium text-muted">
              <input
                type="checkbox"
                id="input-confirm"
                name="confirmAssignment"
                value="1"
                required
                aria-invalid={hasProblem('confirmation_required') ? 'true' : undefined}
                aria-describedby={hasProblem('confirmation_required') ? 'field-error-confirm' : undefined}
                className="mt-0.5 rounded border-line"
              />
              <span lang={locale} className="font-semibold text-text">
                {locale === 'ta'
                  ? 'நான் இந்த பொறுப்பு ஒதுக்கீட்டு விவரங்களைச் சரிபார்த்து உறுதிப்படுத்துகிறேன்.'
                  : 'I confirm that this role assignment and its permission scope are correct and justified under governance rules.'}
              </span>
            </label>
            {hasProblem('confirmation_required') ? (
              <p id="field-error-confirm" role="alert" className="text-xs font-semibold text-error">
                ! {getLocalizedProblem('confirmation_required', locale)}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>
                <span lang={locale}>
                  {locale === 'ta' ? 'உறுதிப்படுத்திப் பொறுப்பை ஒதுக்குக' : 'Confirm and assign role'}
                </span>
              </SubmitButton>
            </div>
          </form>

          <form action={cancelAssignmentPreview}>
            <input type="hidden" name="previewId" value={preview.id} />
            <SubmitButton tone="secondary">
              <span lang={locale}>{locale === 'ta' ? 'முன்னோட்டத்தை ரத்து செய்' : 'Cancel preview'}</span>
            </SubmitButton>
          </form>
        </section>
      ) : null}

      <AssignForm catalogue={catalogue} query={query} locale={locale} />

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? 'செயலில் உள்ள பொறுப்புகள்' : 'Active roles in your areas'}</span>
          </h2>
        </div>
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
            <p lang={locale} className="font-semibold text-text">
              {locale === 'ta'
                ? 'உங்கள் கட்டுப்பாட்டுப் பகுதிகளில் எந்தவொரு செயலிலுள்ள பணியாளர் பொறுப்புகளும் இல்லை.'
                : 'No active staff assignments in your permitted areas.'}
            </p>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold text-text">
                {assignment.fullName} <span className="font-mono text-muted">{assignment.memberCode}</span>
              </p>
              <p className="text-sm text-muted">
                <span lang={locale} className="font-medium text-text">
                  {locale === 'ta' ? 'பொறுப்பு நிலை' : 'Tier'} {assignment.tier}
                </span>{' '}
                · <span lang={locale}>{areaText(assignment.area, areaNames, locale)}</span> ·{' '}
                <span lang={locale}>{locale === 'ta' ? 'வழங்கப்பட்டது:' : 'Granted:'}</span> {formatDate(assignment.grantedAt)}
                {assignment.reviewDueAt ? (
                  <> · <span lang={locale}>{locale === 'ta' ? 'மீளாய்வுத் திகதி:' : 'Review due:'}</span> {formatDate(assignment.reviewDueAt)}</>
                ) : ''}
              </p>
              <p lang={locale} className="text-xs text-muted">{permissionList(assignment.permissions)}</p>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-error">
                  <span lang={locale} className="font-semibold">
                    {locale === 'ta' ? 'பொறுப்பை முடிவுக்குக் கொண்டுவருக' : 'End this role'}
                  </span>
                </summary>
                <form action={revokeAssignment} className="mt-2 flex flex-col gap-3">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <label className="flex flex-col gap-1 font-semibold text-text">
                    <span lang={locale} className="text-xs">
                      {locale === 'ta' ? 'முடிவுக்கான காரணம் *' : 'Reason *'}
                    </span>
                    <input
                      id="input-reason"
                      name="reason"
                      required
                      minLength={3}
                      maxLength={500}
                      aria-invalid={hasProblem('reason_required') ? 'true' : undefined}
                      aria-describedby={hasProblem('reason_required') ? 'field-error-reason' : undefined}
                      className={input}
                    />
                  </label>
                  {hasProblem('reason_required') ? (
                    <p id="field-error-reason" role="alert" className="text-xs font-semibold text-error">
                      ! {getLocalizedProblem('reason_required', locale)}
                    </p>
                  ) : null}

                  <label className="flex items-start gap-2 text-xs font-medium text-error">
                    <input
                      type="checkbox"
                      required
                      id="input-confirm-revoke"
                      name="confirmRevoke"
                      value="1"
                      className="mt-0.5 rounded border-line"
                    />
                    <span lang={locale} className="font-semibold">
                      {locale === 'ta'
                        ? 'இப்பணியாளர் பொறுப்பை உடனடியாக முடிவுக்குக் கொண்டுவருவதை உறுதிப்படுத்துகிறேன்.'
                        : 'Confirm immediate revocation of this staff role and permissions.'}
                    </span>
                  </label>
                  <div>
                    <SubmitButton tone="danger">
                      <span lang={locale}>{locale === 'ta' ? 'பொறுப்பை முடிவுக்குக் கொண்டுவருக' : 'End role'}</span>
                    </SubmitButton>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function AssignForm({
  catalogue,
  query,
  locale,
}: {
  catalogue: AccessCatalogue;
  query: Record<string, string | string[] | undefined>;
  locale: Locale;
}) {
  const permissions = Object.keys(catalogue.permissions).sort();
  const problems = (one(query.problems) ?? '').split(',');
  const hasProblem = (p: string) => problems.includes(p);

  return (
    <details className="rounded-xl border border-line bg-card p-4" open={hasProblem('code_required') || hasProblem('member_not_found')}>
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">
        <span lang={locale} className="font-semibold text-text">
          {locale === 'ta' ? 'பணியாளர் பொறுப்பை ஒதுக்குதல்' : 'Assign a role'}
        </span>
      </summary>
      <form action={previewAssignment} className="mt-3 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1 font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta'
              ? 'உறுப்பினர் அடையாளக் குறியீடு (சரிபார்க்கப்பட்ட, செயலில் உள்ள உறுப்பினர்) *'
              : 'Member ID of a verified, active member *'}
          </span>
          <input
            id="input-code"
            name="code"
            required
            minLength={3}
            aria-invalid={hasProblem('code_required') || hasProblem('member_not_found') ? 'true' : undefined}
            aria-describedby={hasProblem('code_required') || hasProblem('member_not_found') ? 'field-error-code' : undefined}
            className={`${input} font-mono`}
          />
        </label>
        {hasProblem('code_required') || hasProblem('member_not_found') ? (
          <p id="field-error-code" role="alert" className="text-xs font-semibold text-error">
            ! {getLocalizedProblem('code_required', locale)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 font-semibold text-text">
            <span lang={locale} className="text-xs">
              {locale === 'ta' ? 'பொறுப்பு நிலை' : 'Tier'}
            </span>
            <select
              id="input-tier"
              name="tier"
              required
              aria-invalid={hasProblem('tier_not_below_yours') || hasProblem('area_does_not_match_tier') ? 'true' : undefined}
              aria-describedby={hasProblem('tier_not_below_yours') || hasProblem('area_does_not_match_tier') ? 'field-error-tier' : undefined}
              className={input}>
              {catalogue.tiers.map((tier) => (
                <option key={tier.tier} value={tier.tier}>
                  Tier {tier.tier} ({AREA_LEVEL_LABELS[tier.areaLevel]?.[locale] ?? tier.areaLevel})
                </option>
              ))}
            </select>
          </label>
          {hasProblem('tier_not_below_yours') ? (
            <p id="field-error-tier" role="alert" className="text-xs font-semibold text-error">
              ! {getLocalizedProblem('tier_not_below_yours', locale)}
            </p>
          ) : null}

          <label className="flex flex-col gap-1 font-semibold text-text">
            <span lang={locale} className="text-xs">
              {locale === 'ta' ? 'பகுதி நிலை' : 'Area level'}
            </span>
            <select
              id="input-level"
              name="level"
              defaultValue="district"
              className={input}>
              {['gn', 'ds', 'district', 'province', 'platform'].map((level) => (
                <option key={level} value={level}>
                  {AREA_LEVEL_LABELS[level]?.[locale] ?? level}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 font-semibold text-text">
            <span lang={locale} className="text-xs">
              {locale === 'ta' ? 'பகுதிக்குறியீடு' : 'Area code'}
            </span>
            <input
              id="input-areaCode"
              name="areaCode"
              placeholder="LK41"
              aria-invalid={hasProblem('area_outside_yours') || hasProblem('unknown_area') ? 'true' : undefined}
              aria-describedby={hasProblem('area_outside_yours') || hasProblem('unknown_area') ? 'field-error-area' : undefined}
              className={`${input} font-mono`}
            />
          </label>
        </div>
        {hasProblem('area_outside_yours') || hasProblem('unknown_area') ? (
          <p id="field-error-area" role="alert" className="text-xs font-semibold text-error">
            ! {getLocalizedProblem('area_outside_yours', locale)}
          </p>
        ) : null}

        <fieldset id="input-permissions" className="flex flex-col gap-1">
          <legend className="mb-1 font-semibold text-text">
            <span lang={locale} className="block text-xs">
              {locale === 'ta'
                ? 'அனுமதிகள் (தெரிவுசெய்த நிலைக்குரிய அனுமதிகளை மட்டுமே ஒதுக்க முடியும்)'
                : 'Permissions (the tier must allow each; you must hold them)'}
            </span>
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission} className="flex min-h-11 items-center gap-2 text-xs">
                <input type="checkbox" name="permissions" value={permission} />
                <span>
                  <span lang={locale} className="block text-text">{permissionName(permission, locale)}</span>
                  {/* The code stays visible, small, so administrators can match the BRD's permission ids. */}
                  <span className="block font-mono text-[11px] text-muted">{permission}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {hasProblem('no_permissions') || hasProblem('separation_of_duties') ? (
          <p id="field-error-permissions" role="alert" className="text-xs font-semibold text-error">
            ! {getLocalizedProblem('no_permissions', locale)}
          </p>
        ) : null}

        <label className="flex flex-col gap-1 font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta' ? 'விளக்கக் குறிப்பு' : 'Note'}
          </span>
          <input
            id="input-note"
            name="note"
            maxLength={500}
            className={input}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <SubmitButton tone="secondary">
            <span lang={locale}>{locale === 'ta' ? 'முன்மாதிரியைப் பார்க்க' : 'Preview assignment'}</span>
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
