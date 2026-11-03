import type { AccessCatalogue, AssignmentPreviewDetails, ListedAssignment } from '@my-people/api-client';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { cancelAssignmentPreview, createAssignment, previewAssignment, revokeAssignment } from '@/features/organization/actions';
import { areaText, formatDate } from '@/lib/format';
import { messageFor } from '@/lib/messages';
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
  await requireStaff();
  const api = await staffApi();
  let catalogue: AccessCatalogue;
  let assignments: ListedAssignment[];
  try {
    [catalogue, assignments] = await Promise.all([api.getAccessCatalogue(), api.listAssignments('active')]);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
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
            <p lang="ta" className="text-xs font-semibold text-primary">
              பணியாளர் பொறுப்பு ஒதுக்கீடு முன்மாதிரி
            </p>
            <h2 id="preview-heading" className="text-base font-bold">
              Role Assignment Impact Preview
            </h2>
          </div>

          <div className="grid gap-3 rounded-lg border border-line bg-card p-4 sm:grid-cols-2">
            <div>
              <span lang="ta" className="block text-xs font-semibold text-muted">
                உறுப்பினர்
              </span>
              <span lang="en" className="block text-xs text-muted">
                Member
              </span>
              <p className="mt-1 font-semibold text-text">
                {preview.fullName}{' '}
                <span className="font-mono text-xs text-muted">({preview.memberCode})</span>
              </p>
            </div>

            <div>
              <span lang="ta" className="block text-xs font-semibold text-muted">
                பொறுப்பு நிலை மற்றும் பகுதி
              </span>
              <span lang="en" className="block text-xs text-muted">
                Tier and assigned area
              </span>
              <p className="mt-1 font-semibold text-text">
                Tier {preview.tier} ({AREA_LEVEL_LABELS[preview.area.level]?.ta ?? preview.area.level}) ·{' '}
                {preview.area.level === 'platform' ? 'Platform-wide' : preview.area.code || 'Whole level'}
              </p>
            </div>

            <div>
              <span lang="ta" className="block text-xs font-semibold text-muted">
                அடுத்த காலாண்டு மீளாய்வுத் திகதி
              </span>
              <span lang="en" className="block text-xs text-muted">
                Next review due date
              </span>
              <p className="mt-1 font-semibold text-text">
                {preview.reviewDueAt ? formatDate(preview.reviewDueAt) : 'Next quarterly cycle'}
              </p>
            </div>

            <div>
              <span lang="ta" className="block text-xs font-semibold text-muted">
                வழங்கப்படும் அனுமதிகள் ({preview.permissions.length})
              </span>
              <span lang="en" className="block text-xs text-muted">
                Granted permissions ({preview.permissions.length})
              </span>
              <p className="mt-1 font-mono text-xs text-text">
                {preview.permissions.join(', ') || 'None selected'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span lang="ta" className="block text-xs font-semibold text-muted">
                பொறுப்பின் தாக்கம்
              </span>
              <span lang="en" className="block text-xs text-muted">
                Effect of assignment
              </span>
              <div className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs">
                <span lang="ta" className="block font-medium text-text">
                  இந்த உறுப்பினர் தனது பகுதியில் தொடர்புடைய நிர்வாக மற்றும் சரிபார்ப்பு நடவடிக்கைகளை மேற்கொள்வார். பிற பொறுப்புகளுடன் முரண்பாடுகள் இல்லை என்பது உறுதிசெய்யப்பட்டுள்ளது.
                </span>
                <span lang="en" className="mt-0.5 block text-muted">
                  This member will be authorized to carry out administrative and verification actions within their assigned area. Separation-of-duties rules have been validated.
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
              <span>
                <span lang="ta" className="block font-semibold text-text">
                  நான் இந்த பொறுப்பு ஒதுக்கீட்டு விவரங்களைச் சரிபார்த்து உறுதிப்படுத்துகிறேன்.
                </span>
                <span lang="en" className="block text-muted">
                  I confirm that this role assignment and its permission scope are correct and justified under governance rules.
                </span>
              </span>
            </label>
            {hasProblem('confirmation_required') ? (
              <p id="field-error-confirm" role="alert" className="text-xs font-semibold text-error">
                <span lang="ta">! தொடர்வதற்கு உறுதிப்படுத்தல் பெட்டி தெரிவுசெய்யப்பட வேண்டும்.</span> · Confirmation required.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>
                <span className="flex flex-col items-center">
                  <span lang="ta">உறுதிப்படுத்திப் பொறுப்பை ஒதுக்குக</span>
                  <span lang="en" className="text-xs font-normal opacity-90">Confirm and assign role</span>
                </span>
              </SubmitButton>
            </div>
          </form>

          <form action={cancelAssignmentPreview}>
            <input type="hidden" name="previewId" value={preview.id} />
            <SubmitButton tone="secondary">
              <span className="flex flex-col items-center">
                <span lang="ta">முன்னோட்டத்தை ரத்து செய்</span>
                <span lang="en" className="text-xs font-normal opacity-90">Cancel preview</span>
              </span>
            </SubmitButton>
          </form>
        </section>
      ) : null}

      <AssignForm catalogue={catalogue} query={query} />

      <section className="flex flex-col gap-2">
        <div>
          <p lang="ta" className="text-xs font-semibold text-muted">செயலில் உள்ள பொறுப்புகள்</p>
          <h2 className="text-base font-bold">Active roles in your areas</h2>
        </div>
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
            <p lang="ta" className="font-semibold text-text">உங்கள் கட்டுப்பாட்டுப் பகுதிகளில் எந்தவொரு செயலிலுள்ள பணியாளர் பொறுப்புகளும் இல்லை.</p>
            <p lang="en" className="mt-0.5">No active staff assignments in your permitted areas.</p>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold">
                {assignment.fullName} <span className="font-mono text-muted">{assignment.memberCode}</span>
              </p>
              <p className="text-sm text-muted">
                <span lang="ta" className="font-medium text-text">பொறுப்பு நிலை {assignment.tier}</span> ·{' '}
                <span>{areaText(assignment.area)}</span> ·{' '}
                <span lang="ta">வழங்கப்பட்டது:</span> {formatDate(assignment.grantedAt)}
                {assignment.reviewDueAt ? (
                  <> · <span lang="ta">மீளாய்வுத் திகதி:</span> {formatDate(assignment.reviewDueAt)}</>
                ) : ''}
              </p>
              <p className="font-mono text-xs text-muted">{assignment.permissions.join(', ')}</p>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-error">
                  <span lang="ta" className="font-semibold">பொறுப்பை முடிவுக்குக் கொண்டுவருக</span> · End this role
                </summary>
                <form action={revokeAssignment} className="mt-2 flex flex-col gap-3">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <label className="flex flex-col gap-1 font-semibold">
                    <span lang="ta" className="text-xs text-muted">முடிவுக்கான காரணம்</span>
                    <span lang="en" className="text-xs">Reason</span>
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
                      <span lang="ta">! காரணத்தைத் தெரிவுசெய்யவும் அல்லது உள்ளிடவும்.</span> · Reason is required.
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
                    <span>
                      <span lang="ta" className="block font-semibold">
                        இப்பணியாளர் பொறுப்பை உடனடியாக முடிவுக்குக் கொண்டுவருவதை உறுதிப்படுத்துகிறேன்.
                      </span>
                      <span lang="en" className="block text-muted">
                        Confirm immediate revocation of this staff role and permissions.
                      </span>
                    </span>
                  </label>
                  <div>
                    <SubmitButton tone="danger">
                      <span className="flex flex-col items-center">
                        <span lang="ta">பொறுப்பை முடிவுக்குக் கொண்டுவருக</span>
                        <span lang="en" className="text-xs font-normal opacity-90">End role</span>
                      </span>
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

function AssignForm({ catalogue, query }: { catalogue: AccessCatalogue; query: Record<string, string | string[] | undefined> }) {
  const permissions = Object.keys(catalogue.permissions).sort();
  const problems = (one(query.problems) ?? '').split(',');
  const hasProblem = (p: string) => problems.includes(p);

  return (
    <details className="rounded-xl border border-line bg-card p-4" open={hasProblem('code_required') || hasProblem('member_not_found')}>
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">
        <span lang="ta" className="font-semibold">பணியாளர் பொறுப்பை ஒதுக்குதல்</span> · Assign a role
      </summary>
      <form action={previewAssignment} className="mt-3 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1 font-semibold">
          <span lang="ta" className="text-xs text-muted">உறுப்பினர் அடையாளக் குறியீடு (சரிபார்க்கப்பட்ட, செயலில் உள்ள உறுப்பினர்)</span>
          <span lang="en" className="text-xs">Member ID of a verified, active member</span>
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
            <span lang="ta">! உறுப்பினர் அடையாளக் குறியீடு அவசியமானது மற்றும் சரியானதாக இருக்க வேண்டும்.</span> · Valid member ID code required.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 font-semibold">
            <span lang="ta" className="text-xs text-muted">பொறுப்பு நிலை</span>
            <span lang="en" className="text-xs">Tier</span>
            <select
              id="input-tier"
              name="tier"
              required
              aria-invalid={hasProblem('tier_not_below_yours') || hasProblem('area_does_not_match_tier') ? 'true' : undefined}
              aria-describedby={hasProblem('tier_not_below_yours') || hasProblem('area_does_not_match_tier') ? 'field-error-tier' : undefined}
              className={input}>
              {catalogue.tiers.map((tier) => (
                <option key={tier.tier} value={tier.tier}>
                  Tier {tier.tier} ({AREA_LEVEL_LABELS[tier.areaLevel]?.ta ?? tier.areaLevel})
                </option>
              ))}
            </select>
          </label>
          {hasProblem('tier_not_below_yours') ? (
            <p id="field-error-tier" role="alert" className="text-xs font-semibold text-error">
              <span lang="ta">! உங்கள் நிலைக்குக் கீழான நிலைகளை மட்டுமே நீங்கள் ஒதுக்க முடியும்.</span> · Tier must be below yours.
            </p>
          ) : null}

          <label className="flex flex-col gap-1 font-semibold">
            <span lang="ta" className="text-xs text-muted">பகுதி நிலை</span>
            <span lang="en" className="text-xs">Area level</span>
            <select
              id="input-level"
              name="level"
              defaultValue="district"
              className={input}>
              {['gn', 'ds', 'district', 'province', 'platform'].map((level) => (
                <option key={level} value={level}>
                  {AREA_LEVEL_LABELS[level]?.ta ?? level} · {AREA_LEVEL_LABELS[level]?.en ?? level}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 font-semibold">
            <span lang="ta" className="text-xs text-muted">பகுதிக்குறியீடு</span>
            <span lang="en" className="text-xs">Area code</span>
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
            <span lang="ta">! செல்லுபடியான உங்கள் கட்டுப்பாட்டுக்குட்பட்ட பகுதிக்குறியீட்டை உள்ளிடவும்.</span> · Valid area code required.
          </p>
        ) : null}

        <fieldset id="input-permissions" className="flex flex-col gap-1">
          <legend className="mb-1 font-semibold">
            <span lang="ta" className="block text-xs text-muted">அனுமதிகள் (தெரிவுசெய்த நிலைக்குரிய அனுமதிகளை மட்டுமே ஒதுக்க முடியும்)</span>
            <span lang="en" className="block text-xs">Permissions (the tier must allow each; you must hold them)</span>
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission} className="flex min-h-11 items-center gap-2 font-mono text-xs">
                <input type="checkbox" name="permissions" value={permission} /> {permission}
              </label>
            ))}
          </div>
        </fieldset>
        {hasProblem('no_permissions') || hasProblem('separation_of_duties') ? (
          <p id="field-error-permissions" role="alert" className="text-xs font-semibold text-error">
            <span lang="ta">! பொருத்தமான அனுமதிகளைத் தெரிவுசெய்யவும்.</span> · Valid permission selection required.
          </p>
        ) : null}

        <label className="flex flex-col gap-1 font-semibold">
          <span lang="ta" className="text-xs text-muted">விளக்கக் குறிப்பு</span>
          <span lang="en" className="text-xs">Note</span>
          <input
            id="input-note"
            name="note"
            maxLength={500}
            className={input}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <SubmitButton tone="secondary">
            <span className="flex flex-col items-center">
              <span lang="ta">முன்மாதிரியைப் பார்க்க</span>
              <span lang="en" className="text-xs font-normal opacity-90">Preview assignment</span>
            </span>
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
