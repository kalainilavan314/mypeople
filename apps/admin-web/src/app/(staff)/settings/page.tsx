import type { FeatureFlag, Place } from '@my-people/api-client';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { disableFeature, enableFeature, recordGate } from '@/features/settings/actions';
import { formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const GATES = ['G0', 'G1', 'G2', 'G3'] as const;

export default function SettingsPage(props: PageProps<'/settings'>) {
  return (
    <>
      <PageHeader ta="கணினி அமைப்புகள் & பதிவேடு" en="Settings & registry administration" />
      <Suspense fallback={<p className="text-muted">… Loading system settings and registries</p>}>
        <SettingsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<'/settings'>['searchParams'] }) {
  await requireStaff();
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
    if (isRefusal(err)) return <p className="text-error">! {messageFor(err.code)}</p>;
    throw err;
  }

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />
      <div className="flex flex-col gap-8">
      {/* 1. Feature Flags & Phase Gates */}
      <section aria-labelledby="flags-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
          <div>
            <h2 id="flags-heading" className="text-lg font-bold">
              1. Feature modules and phase gates
            </h2>
            <p className="text-xs text-muted">
              v1.1 architecture modules require documented phase gate approval before they can be activated in production.
            </p>
          </div>
          <span className="text-xs font-semibold text-muted">
            {enabledCount} of {flags.length} active
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Feature flag registry</caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Module</th>
                <th scope="col" className="px-3 py-2">Phase</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Required Gate</th>
                <th scope="col" className="px-3 py-2">Recorded Gate & Approval</th>
                <th scope="col" className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {flags.map((flag) => (
                <tr key={flag.key} className="hover:bg-surface/50">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{flag.nameEn}</p>
                    <p className="font-mono text-xs text-muted">{flag.key}</p>
                  </td>
                  <td className="px-3 py-3">Phase {flag.phase}</td>
                  <td className="px-3 py-3">
                    <StateTag state={flag.enabled ? 'enabled' : 'disabled'} />
                  </td>
                  <td className="px-3 py-3 font-mono font-medium">{flag.requiredGate}</td>
                  <td className="px-3 py-3 text-xs">
                    {flag.gate ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-semibold">{flag.gate}</span>
                        <span className="text-muted">Ref: {flag.approvalRef}</span>
                        <span className="text-muted">{formatDateTime(flag.gateRecordedAt)}</span>
                      </div>
                    ) : (
                      <span className="text-warning font-medium">Gate not recorded</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex flex-col items-end gap-2">
                      {/* If gate not recorded yet */}
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
                              placeholder="Approval sign-off ref..."
                              className="rounded border border-line px-2 py-1 text-xs"
                            />
                          </div>
                          <input
                            name="reason"
                            required
                            placeholder="Reason for recording gate..."
                            className="rounded border border-line px-2 py-1 text-xs"
                          />
                          <SubmitButton tone="secondary">Record gate</SubmitButton>
                        </form>
                      ) : null}

                      {/* If gate recorded and disabled: allow enable */}
                      {flag.gate && !flag.enabled ? (
                        <form action={enableFeature} className="flex flex-col gap-1.5 rounded border border-line bg-surface p-2 text-left">
                          <input type="hidden" name="key" value={flag.key} />
                          <input
                            name="reason"
                            required
                            minLength={3}
                            placeholder="Reason for enabling..."
                            className="rounded border border-line px-2 py-1 text-xs"
                          />
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" name="confirmEnable" value="1" required />
                            <span>Confirm enable</span>
                          </label>
                          <SubmitButton tone="primary">Enable module</SubmitButton>
                        </form>
                      ) : null}

                      {/* If enabled: allow disable */}
                      {flag.enabled ? (
                        <form action={disableFeature} className="flex flex-col gap-1.5 rounded border border-error/40 bg-surface p-2 text-left">
                          <input type="hidden" name="key" value={flag.key} />
                          <input
                            name="reason"
                            required
                            minLength={3}
                            placeholder="Reason for disabling..."
                            className="rounded border border-line px-2 py-1 text-xs"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-error font-medium">
                            <input type="checkbox" name="confirmDisable" value="1" required />
                            <span>Confirm immediate disable</span>
                          </label>
                          <SubmitButton tone="danger">Disable module</SubmitButton>
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

      {/* 2. System Configuration & Security Status (Read-only) */}
      <section aria-labelledby="system-heading" className="flex flex-col gap-4">
        <div className="border-b border-line pb-2">
          <h2 id="system-heading" className="text-lg font-bold">
            2. System configuration & security policies
          </h2>
          <p className="text-xs text-muted">
            Read-only platform security policies and environmental controls enforced across all operations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">Authentication policy</span>
            <p className="mt-1 font-bold">Mandatory Staff MFA (TOTP)</p>
            <p className="mt-1 text-xs text-muted">RFC 6238 time-based authenticator code required per staff session.</p>
          </div>

          <div className="rounded-xl border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">Session security</span>
            <p className="mt-1 font-bold">15-minute access lifetime</p>
            <p className="mt-1 text-xs text-muted">Rotating single-use refresh tokens with automated reuse detection.</p>
          </div>

          <div className="rounded-xl border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">Audit trail integrity</span>
            <p className="mt-1 font-bold">Cryptographic hash-chaining</p>
            <p className="mt-1 text-xs text-muted">Append-only database triggers with tamper-evident chain verification.</p>
          </div>

          <div className="rounded-xl border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">Evidence vault</span>
            <p className="mt-1 font-bold">AES-256-GCM encryption</p>
            <p className="mt-1 text-xs text-muted">5-minute short-lived signed links inside reviewer&apos;s open claim only.</p>
          </div>

          <div className="rounded-xl border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">Content security</span>
            <p className="mt-1 font-bold">EXIF/GPS metadata stripping</p>
            <p className="mt-1 text-xs text-muted">Uploaded gallery photos re-encoded as WebP without camera or location tags.</p>
          </div>

          <div className="rounded-xl border border-line bg-card p-4">
            <span className="text-xs font-semibold text-muted">Electoral compliance</span>
            <p className="mt-1 font-bold">Silence window automation</p>
            <p className="mt-1 text-xs text-muted">Automatic suspension of public events and announcement campaigns.</p>
          </div>
        </div>
      </section>

      {/* 3. Administrative Geography Registry (Read-only + Backend gap documentation) */}
      <section aria-labelledby="geo-heading" className="flex flex-col gap-4">
        <div className="border-b border-line pb-2">
          <h2 id="geo-heading" className="text-lg font-bold">
            3. Administrative geography registry (Read-only status)
          </h2>
          <p className="text-xs text-muted">
            Official territorial units of Sri Lanka utilized for granular role scoping and operational routing.
          </p>
        </div>

        {/* Backend Gap Documentation Notice */}
        <div className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
          <p className="font-bold">! Architecture & API Status Notice:</p>
          <p className="mt-1 text-xs leading-relaxed">
            The geography registry is currently operating in a <strong>read-only registry view</strong>. Direct mutation endpoints
            (such as adding, renaming, or redistricting electoral areas or GN divisions) are not yet exposed via FastAPI (/v1/geography).
            All administrative divisions are currently seeded and synchronized via versioned database migrations. A dedicated
            interactive boundary editor is planned for Phase 2.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Electoral and administrative districts</caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Code</th>
                <th scope="col" className="px-3 py-2">District (English)</th>
                <th scope="col" className="px-3 py-2">மாவட்டம் (Tamil)</th>
                <th scope="col" className="px-3 py-2">දිස්ත්‍රික්කය (Sinhala)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {districts.map((d) => (
                <tr key={d.code} className="hover:bg-surface/50">
                  <td className="px-3 py-2 font-mono font-bold text-xs">{d.code}</td>
                  <td className="px-3 py-2 font-medium">{d.nameEn}</td>
                  <td lang="ta" className="px-3 py-2">
                    {d.nameTa}
                  </td>
                  <td lang="si" className="px-3 py-2 text-muted">
                    {d.nameSi}
                  </td>
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
