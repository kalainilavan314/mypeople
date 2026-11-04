import type { FeatureFlag, Place } from '@my-people/api-client';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { LanguageSelector } from '@/components/LanguageSelector';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { disableFeature, enableFeature, recordGate } from '@/features/settings/actions';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const GATES = ['G0', 'G1', 'G2', 'G3'] as const;

export default function SettingsPage(props: PageProps<'/settings'>) {
  return (
    <>
      <PageHeader ta="கணினி அமைப்புகள் & பதிவேடு" en="Settings & registry administration" />
      <Suspense fallback={<ConsoleLoading />}>
        <SettingsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<'/settings'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const params = await searchParams;
  const error = one(params.error);
  const problems = one(params.problems);
  const done = one(params.done);

  const api = await staffApi();
  let flags: FeatureFlag[] = [];
  let districts: Place[] = [];

  try {
    [flags, districts] = await Promise.all([
      api.getFeatureRegistry(),
      api.listDistricts(),
    ]);
  } catch (err) {
    if (isRefusal(err)) return <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>;
    throw err;
  }

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />
      <div className="flex flex-col gap-8">
        {/* 1. Language Preference Settings Card */}
        <section aria-labelledby="language-heading" className="flex flex-col gap-3">
          <LanguageSelector variant="card" />
        </section>

        {/* 2. Feature Flags & Phase Gates */}
        <section aria-labelledby="flags-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
            <div>
              <h2 id="flags-heading" className="text-lg font-bold text-text">
                <span lang={locale}>{locale === 'ta' ? 'செயல்பாட்டுக் கட்டுப்பாடுகள் மற்றும் கட்டக் கட்டுப்பாடுகள்' : 'Feature modules and phase gates'}</span>
              </h2>
              <p className="text-xs text-muted">
                {locale === 'ta'
                  ? 'கட்டமைப்பு தொகுதிகளை உற்பத்தியில் இயக்குவதற்கு முன் முறையான கட்டக் கட்டுப்பாட்டு ஒப்புதல் அவசியமாகும்.'
                  : 'Architecture modules require documented phase gate approval before they can be activated in production.'}
              </p>
            </div>
            <span className="text-xs font-semibold text-muted">
              {locale === 'ta' ? `${flags.length} இல் ${enabledCount} இயங்குகின்றன` : `${enabledCount} of ${flags.length} active`}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Feature flag registry</caption>
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'தொகுதி' : 'Module'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'கட்டம்' : 'Phase'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'நிலை' : 'Status'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'தேவையான கட்டுப்பாடு' : 'Required Gate'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'பதிவான கட்டுப்பாடு & ஒப்புதல்' : 'Recorded Gate & Approval'}</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-text">{locale === 'ta' ? 'நடவடிக்கைகள்' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {flags.map((flag) => (
                  <tr key={flag.key} className="hover:bg-surface/50">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-text">{flag.nameEn}</p>
                      <p className="font-mono text-xs text-muted">{flag.key}</p>
                    </td>
                    <td className="px-3 py-3">{locale === 'ta' ? `கட்டம் ${flag.phase}` : `Phase ${flag.phase}`}</td>
                    <td className="px-3 py-3">
                      <StateTag state={flag.enabled ? 'enabled' : 'disabled'} />
                    </td>
                    <td className="px-3 py-3 font-mono font-medium">{flag.requiredGate}</td>
                    <td className="px-3 py-3 text-xs">
                      {flag.gate ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-semibold">{flag.gate}</span>
                          <span className="text-muted">{locale === 'ta' ? 'குறிப்பு' : 'Ref'}: {flag.approvalRef}</span>
                          <span className="text-muted">{formatDateTime(flag.gateRecordedAt)}</span>
                        </div>
                      ) : (
                        <span className="text-warning font-medium">{locale === 'ta' ? 'கட்டுப்பாடு இன்னும் பதியப்படவில்லை' : 'Gate not recorded'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {!flag.gate ? (
                          <form action={recordGate} className="flex flex-col gap-2 rounded border border-line bg-surface p-2 text-left">
                            <input type="hidden" name="key" value={flag.key} />
                            <div className="flex gap-2">
                              <select name="gate" defaultValue={flag.requiredGate} className="rounded border border-line px-1.5 py-1 text-xs">
                                {GATES.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                              <input
                                name="approvalRef"
                                required
                                placeholder={locale === 'ta' ? 'ஒப்புதல் குறிப்பு எண்...' : 'Approval sign-off ref...'}
                                className="rounded border border-line px-2 py-1 text-xs"
                              />
                            </div>
                            <input
                              name="reason"
                              required
                              placeholder={locale === 'ta' ? 'காரணம்...' : 'Reason for recording gate...'}
                              className="rounded border border-line px-2 py-1 text-xs"
                            />
                            <SubmitButton tone="secondary">
                              {locale === 'ta' ? 'கட்டுப்பாட்டைப் பதிவுசெய்க' : 'Record gate'}
                            </SubmitButton>
                          </form>
                        ) : null}

                        {flag.gate && !flag.enabled ? (
                          <form action={enableFeature} className="flex flex-col gap-1.5 rounded border border-line bg-surface p-2 text-left">
                            <input type="hidden" name="key" value={flag.key} />
                            <input
                              name="reason"
                              required
                              minLength={3}
                              placeholder={locale === 'ta' ? 'இயக்குவதற்கான காரணம்...' : 'Reason for enabling...'}
                              className="rounded border border-line px-2 py-1 text-xs"
                            />
                            <label className="flex items-center gap-1.5 text-xs">
                              <input type="checkbox" name="confirmEnable" value="1" required />
                              <span lang={locale}>{locale === 'ta' ? 'இயக்குவதை உறுதிசெய்கிறேன்' : 'Confirm enable'}</span>
                            </label>
                            <SubmitButton tone="primary">
                              {locale === 'ta' ? 'தொகுதியை இயக்குக' : 'Enable module'}
                            </SubmitButton>
                          </form>
                        ) : null}

                        {flag.enabled ? (
                          <form action={disableFeature} className="flex flex-col gap-1.5 rounded border border-error/40 bg-surface p-2 text-left">
                            <input type="hidden" name="key" value={flag.key} />
                            <input
                              name="reason"
                              required
                              minLength={3}
                              placeholder={locale === 'ta' ? 'முடக்குவதற்கான காரணம்...' : 'Reason for disabling...'}
                              className="rounded border border-line px-2 py-1 text-xs"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-error font-medium">
                              <input type="checkbox" name="confirmDisable" value="1" required />
                              <span lang={locale}>{locale === 'ta' ? 'உடனடி முடக்கத்தை உறுதிசெய்கிறேன்' : 'Confirm immediate disable'}</span>
                            </label>
                            <SubmitButton tone="danger">
                              {locale === 'ta' ? 'தொகுதியை முடக்குக' : 'Disable module'}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. System Configuration & Security Status (Read-only) */}
        <section aria-labelledby="system-heading" className="flex flex-col gap-4">
          <div className="border-b border-line pb-2">
            <h2 id="system-heading" className="text-lg font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'கணினி கட்டமைப்பு மற்றும் பாதுகாப்பு விதிகள்' : 'System configuration & security policies'}</span>
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? 'அனைத்து செயல்பாடுகளிலும் கட்டாயமாக அமல்படுத்தப்படும் தளத்தின் பாதுகாப்பு விதிகள்.'
                : 'Platform security policies and environmental controls enforced across all operations.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{locale === 'ta' ? 'அங்கீகாரக் கொள்கை' : 'Authentication policy'}</span>
              <p className="mt-1 font-bold">{locale === 'ta' ? 'கட்டாய பணியாளர் MFA (TOTP)' : 'Mandatory Staff MFA (TOTP)'}</p>
              <p className="mt-1 text-xs text-muted">
                {locale === 'ta'
                  ? 'ஒவ்வொரு பணியாளர் அமர்வுக்கும் RFC 6238 அடிப்படையிலான குறியீடு தேவை.'
                  : 'RFC 6238 time-based authenticator code required per staff session.'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{locale === 'ta' ? 'அமர்வுப் பாதுகாப்பு' : 'Session security'}</span>
              <p className="mt-1 font-bold">{locale === 'ta' ? '15 நிமிட அணுகல் காலம்' : '15-minute access lifetime'}</p>
              <p className="mt-1 text-xs text-muted">
                {locale === 'ta'
                  ? 'மறுபயன்பாட்டு கண்டறிதலுடன் கூடிய ஒற்றைப் பயன்பாட்டு டோக்கன்கள்.'
                  : 'Rotating single-use refresh tokens with automated reuse detection.'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{locale === 'ta' ? 'தணிக்கை ஒருமைப்பாடு' : 'Audit trail integrity'}</span>
              <p className="mt-1 font-bold">{locale === 'ta' ? 'கிரிப்டோகிராஃபிக் ஹாஷ் இணைப்பு' : 'Cryptographic hash-chaining'}</p>
              <p className="mt-1 text-xs text-muted">
                {locale === 'ta'
                  ? 'மாற்றமுடியாத தரவுத்தள பதிவுகள் மற்றும் சங்கிலி சரிபார்ப்பு.'
                  : 'Append-only database triggers with tamper-evident chain verification.'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{locale === 'ta' ? 'சான்றுப் பெட்டகம்' : 'Evidence vault'}</span>
              <p className="mt-1 font-bold">{locale === 'ta' ? 'AES-256-GCM குறியாக்கம்' : 'AES-256-GCM encryption'}</p>
              <p className="mt-1 text-xs text-muted">
                {locale === 'ta'
                  ? 'மதிப்பீட்டாளர் பொறுப்பேற்பின் போது மட்டுமே 5 நிமிட தற்காலிக இணைப்புகள்.'
                  : '5-minute short-lived signed links inside reviewer’s open claim only.'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{locale === 'ta' ? 'உள்ளடக்கப் பாதுகாப்பு' : 'Content security'}</span>
              <p className="mt-1 font-bold">{locale === 'ta' ? 'EXIF/GPS நீக்கம்' : 'EXIF/GPS metadata stripping'}</p>
              <p className="mt-1 text-xs text-muted">
                {locale === 'ta'
                  ? 'பதிவேற்றப்படும் படங்கள் இருப்பிடத் தகவல்கள் இன்றி WebP ஆக மாற்றப்படுகின்றன.'
                  : 'Uploaded gallery photos re-encoded as WebP without camera or location tags.'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <span className="text-xs font-semibold text-muted">{locale === 'ta' ? 'தேர்தல் விதிமுறைகள்' : 'Electoral compliance'}</span>
              <p className="mt-1 font-bold">{locale === 'ta' ? 'அமைதிக்கால தன்னியக்கம்' : 'Silence window automation'}</p>
              <p className="mt-1 text-xs text-muted">
                {locale === 'ta'
                  ? 'பொது நிகழ்வுகள் மற்றும் பிரச்சார அறிவித்தல்கள் தானாகவே இடைநிறுத்தப்படும்.'
                  : 'Automatic suspension of public events and announcement campaigns.'}
              </p>
            </div>
          </div>
        </section>

        {/* 4. Administrative Geography Registry (Read-only) */}
        <section aria-labelledby="geo-heading" className="flex flex-col gap-4">
          <div className="border-b border-line pb-2">
            <h2 id="geo-heading" className="text-lg font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'நிர்வாக புவியியல் பதிவேடு (பார்வை மட்டும்)' : 'Administrative geography registry (Read-only status)'}</span>
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? 'பணியாளர் அதிகார வரம்புகள் மற்றும் செயல்பாட்டு வழிகாட்டலுக்குப் பயன்படுத்தப்படும் உத்தியோகபூர்வ பகுதிகள்.'
                : 'Official territorial units of Sri Lanka utilized for granular role scoping and operational routing.'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Electoral and administrative districts</caption>
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'குறியீடு' : 'Code'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'மாவட்டம் (ஆங்கிலம்)' : 'District (English)'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'மாவட்டம் (தமிழ்)' : 'District (Tamil)'}</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'மாவட்டம் (சிங்களம்)' : 'District (Sinhala)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {districts.map((d) => (
                  <tr key={d.code} className="hover:bg-surface/50">
                    <td className="px-3 py-2 font-mono font-bold text-xs">{d.code}</td>
                    <td className="px-3 py-2 font-medium">{d.nameEn}</td>
                    <td lang="ta" className="px-3 py-2">{d.nameTa}</td>
                    <td lang="si" className="px-3 py-2 text-muted">{d.nameSi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
