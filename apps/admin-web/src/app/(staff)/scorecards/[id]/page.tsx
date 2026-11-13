import { ApiError, type ScorecardFile } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { decideCorrection, publishScorecard, requestCorrection, setScorecardNote, shareScorecard } from '@/features/scorecards/actions';
import { METRICS, SCORECARD_TARGETS, STATE_LABELS, metricText, noteFor, readFigures } from '@/features/scorecards/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This scorecard does not exist.';
const REFUSED = 'Scorecards need scorecard publishing or a community case permission.';
const TONES = { draft: 'neutral', shared: 'waiting', published: 'done', superseded: 'neutral' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D17: one scorecard version: figures per area with their parts, context notes, corrections, sharing and publishing. */
export default function ScorecardPage(props: PageProps<'/scorecards/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <ScorecardView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ScorecardView({ params, searchParams }: Pick<PageProps<'/scorecards/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/scorecards">Back to scorecards</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let file: ScorecardFile;
  try {
    file = await (await staffApi()).getScorecard(id);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Scorecards" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }
  const card = file.scorecard;
  const areas = readFigures(card.figures);
  const areaNames = await loadAreaNames(areas.map((area) => area.areaKey));
  const publisher = staff.permissions.has('scorecard.publish');
  const editable = card.state === 'draft' || card.state === 'shared';
  const areaOptions = areas.map((area) => ({ value: area.areaKey, label: `${areaText(area.areaKey, areaNames, 'ta')} · ${areaText(area.areaKey, areaNames, 'en')}` }));
  const metricOptions = METRICS.map((metric) => ({ value: metric.key, label: `${metric.label.ta} · ${metric.label.en}` }));
  const openCorrections = file.corrections.filter((correction) => correction.state === 'open');

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">
            {card.period} · version {card.version}
          </span>
          <BilingualTag label={STATE_LABELS[card.state]} tone={TONES[card.state]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">மதிப்பீட்டு அட்டை {card.period}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            Scorecard for {card.period}
          </span>
        </h1>
        <p className="text-sm text-muted">
          Service levels: {card.slaVersion} · drafted {formatDateTime(card.createdAt)}
          {card.sharedAt ? ` · shared ${formatDateTime(card.sharedAt)}` : ''}
          {card.publishedAt ? ` · published ${formatDateTime(card.publishedAt)}` : ''}
        </p>
        {card.correctionReason ? <p className="text-sm text-warning">This version follows a correction: {card.correctionReason}</p> : null}
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="figures" ta="பகுதிவாரியான எண்ணிக்கைகள்" en={`Figures by area (${areas.length})`} intro="Each rate shows numerator ÷ denominator. Fewer than 10 accepted cases: Insufficient data, and no figures.">
            {areas.length === 0 ? (
              <p className="text-sm text-muted">No area had accepted cases in this quarter.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {areas.map((area) => {
                  const note = noteFor(card.notes, area.areaKey);
                  return (
                    <li key={area.areaKey} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                      <h3 className="flex flex-col font-semibold text-text">
                        <span lang="ta">{areaText(area.areaKey, areaNames, 'ta')}</span>
                        <span lang="en" className="text-sm font-medium text-muted">
                          {areaText(area.areaKey, areaNames, 'en')}
                        </span>
                      </h3>
                      {area.insufficient ? (
                        <p className="flex flex-col text-sm font-semibold text-muted">
                          <span lang="ta">போதிய தரவு இல்லை</span>
                          <span lang="en">Insufficient data</span>
                        </p>
                      ) : (
                        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                          {area.metrics.map((metric) => {
                            const label = METRICS.find((m) => m.key === metric.key)?.label;
                            return (
                              <div key={metric.key} className="flex flex-col">
                                <dt className="text-xs text-muted">
                                  <span lang="ta">{label?.ta}</span> · {label?.en}
                                </dt>
                                <dd className="font-semibold tabular-nums text-text">{metricText(metric)}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                      {note ? (
                        <div className="rounded-lg bg-surface p-2 text-sm">
                          <p className="text-xs font-semibold text-muted">Context note</p>
                          <Both ta={note.ta} en={note.en} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section id="corrections" ta="திருத்தக் கோரிக்கைகள்" en={`Corrections (${file.corrections.length})`} intro="Accepting a correction recomputes the figures; on a published scorecard it publishes the next version, and this one stays readable.">
            {file.corrections.length === 0 ? (
              <p className="text-sm text-muted">No corrections requested.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {file.corrections.map((correction) => (
                  <li key={correction.id} className="flex flex-col gap-2 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag
                        label={correction.state === 'open' ? { ta: 'திறந்துள்ளது', en: 'Open' } : correction.state === 'accepted' ? { ta: 'ஏற்கப்பட்டது', en: 'Accepted' } : { ta: 'நிராகரிக்கப்பட்டது', en: 'Rejected' }}
                        tone={correction.state === 'open' ? 'waiting' : correction.state === 'accepted' ? 'done' : 'refused'}
                      />
                      <span className="text-text">
                        {areaText(correction.areaKey, areaNames, 'en')} · {METRICS.find((m) => m.key === correction.metric)?.label.en ?? correction.metric}
                      </span>
                      <span className="text-xs tabular-nums text-muted">{formatDateTime(correction.createdAt)}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-text">{correction.reason}</p>
                    {correction.decisionNote ? <p className="text-xs text-muted">Decision: {correction.decisionNote}</p> : null}
                    {correction.state === 'open' && publisher ? (
                      <SimpleForm
                        id={`correction-${correction.id.slice(0, 8)}`}
                        action={decideCorrection}
                        hidden={{ scorecardId: card.id, correctionId: correction.id }}
                        fields={[
                          {
                            name: 'decision',
                            label: 'Decision',
                            kind: 'radio',
                            required: true,
                            options: [
                              { value: 'accept', label: 'Accept and recompute' },
                              { value: 'reject', label: 'Reject' },
                            ],
                          },
                          { name: 'note', label: 'Note explaining the decision', kind: 'textarea', required: true, minLength: 3, maxLength: 1000 },
                        ]}
                        submits={[{ label: 'Record decision' }]}
                        targets={SCORECARD_TARGETS}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside aria-label="Sharing and publishing" className="flex flex-col gap-4">
          {publisher && card.state === 'draft' ? (
            <SimpleForm
              id="share"
              title="Share with the responsible tiers"
              intro="They then have 10 working days to ask for corrections before it can be published."
              action={shareScorecard}
              hidden={{ scorecardId: card.id }}
              fields={[]}
              submits={[{ label: 'Share for review' }]}
              targets={SCORECARD_TARGETS}
            />
          ) : null}
          {card.state === 'shared' ? (
            <div className="rounded-xl border border-line bg-card p-4 text-sm">
              <p className="font-semibold text-text">Review period</p>
              <p className="text-muted">Publishing is possible from {formatDateTime(card.publishableAt)} (10 working days after sharing).</p>
              {openCorrections.length > 0 ? <p className="mt-1 font-semibold text-warning">! {openCorrections.length} correction requests are open.</p> : null}
            </div>
          ) : null}
          {publisher && card.state === 'shared' ? (
            <SimpleForm
              id="publish"
              title="Publish"
              intro="Members then see these figures for their areas."
              action={publishScorecard}
              hidden={{ scorecardId: card.id }}
              fields={[]}
              submits={[{ label: 'Publish scorecard' }]}
              targets={SCORECARD_TARGETS}
            />
          ) : null}
          {card.state !== 'superseded' && areas.length > 0 ? (
            <SimpleForm
              id="request-correction"
              title="Ask for a correction"
              intro="Name the area and the figure, and say what is wrong."
              action={requestCorrection}
              hidden={{ scorecardId: card.id }}
              fields={[
                { name: 'areaKey', label: 'Area', kind: 'select', required: true, options: [{ value: '', label: 'Choose an area' }, ...areaOptions], wide: true },
                { name: 'metric', label: 'Figure', kind: 'select', required: true, options: [{ value: '', label: 'Choose a figure' }, ...metricOptions], wide: true },
                { name: 'reason', label: 'What is wrong', kind: 'textarea', required: true, minLength: 5, maxLength: 1000 },
              ]}
              submits={[{ label: 'Send correction request', tone: 'secondary' }]}
              targets={SCORECARD_TARGETS}
            />
          ) : null}
          {publisher && editable && areas.length > 0 ? (
            <SimpleForm
              id="note"
              title="Context note for an area"
              intro="Beside an area's values, in both languages (a flood, a vacancy). Empty in both removes it."
              action={setScorecardNote}
              hidden={{ scorecardId: card.id }}
              fields={[
                { name: 'areaKey', label: 'Area', kind: 'select', required: true, options: [{ value: '', label: 'Choose an area' }, ...areaOptions], wide: true },
                { name: 'noteTa', label: 'Note in Tamil', kind: 'textarea', lang: 'ta', maxLength: 800 },
                { name: 'noteEn', label: 'Note in English', kind: 'textarea', lang: 'en', maxLength: 500 },
              ]}
              submits={[{ label: 'Save note', tone: 'secondary' }]}
              targets={SCORECARD_TARGETS}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
