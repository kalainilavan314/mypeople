import { ApiError, type ManagedVolunteerOpportunity, type VolunteerOfferCard, type VolunteerSkill } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import {
  AVAILABILITY_LABELS,
  OFFER_STATE_LABELS,
  OPPORTUNITY_STATE_LABELS,
  TEXT_FIELDS,
  TRAVEL_LABELS,
} from '@/features/volunteering/forms';
import { OfferDecisionForm } from '@/features/volunteering/OfferDecisionForm';
import { OpportunityForm } from '@/features/volunteering/OpportunityForm';
import { OpportunityMoves } from '@/features/volunteering/OpportunityMoves';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const NOT_FOUND = 'This opportunity does not exist or is outside your areas.';
const REFUSED = 'Volunteering opportunities need the volunteer management permission (volunteers.manage).';
const STATE_TONES = { draft: 'neutral', open: 'waiting', closed: 'done', cancelled: 'refused' } as const;
const OFFER_TONES: Record<string, 'waiting' | 'done' | 'refused' | 'neutral'> = {
  offered: 'waiting',
  confirmed: 'done',
  declined: 'refused',
  withdrawn: 'neutral',
  cancelled: 'refused',
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** S10: one opportunity, the offers to decide, its text to change, and the state moves it allows. */
export default function OpportunityPage(props: PageProps<'/volunteering/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <OpportunityView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function OpportunityView({ params, searchParams }: Pick<PageProps<'/volunteering/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = (
    <Link href="/volunteering" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← Back to volunteering opportunities
    </Link>
  );
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }

  const client = await staffApi();
  let opportunity: ManagedVolunteerOpportunity;
  let offers: VolunteerOfferCard[];
  try {
    [opportunity, offers] = await Promise.all([client.getManagedVolunteerOpportunity(id), client.listVolunteerOffers(id)]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return (
        <>
          {backLink}
          <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Volunteering is not switched on yet.</p>
        </>
      );
    }
    return (
      <>
        {backLink}
        <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
      </>
    );
  }
  // Skill names only replace keys on screen; without them the keys are shown.
  let skills: VolunteerSkill[] = [];
  try {
    skills = (await client.getVolunteerSkills()).skills;
  } catch {
    skills = [];
  }
  const skillName = (key: string) => skills.find((skill) => skill.key === key);
  const areaNames = await loadAreaNames([opportunity.areaKey]);
  const placesLeft = opportunity.places - opportunity.confirmed;
  const current: Record<string, string> = {
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, String(opportunity[field as keyof ManagedVolunteerOpportunity] ?? '')])),
    startsAt: toSriLankaDateTimeInput(opportunity.startsAt),
    endsAt: toSriLankaDateTimeInput(opportunity.endsAt),
    places: String(opportunity.places),
  };
  const waitingOffers = offers.filter((offer) => offer.state === 'offered');
  const otherOffers = offers.filter((offer) => offer.state !== 'offered');

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{opportunity.opportunityRef}</span>
          <BilingualTag label={OPPORTUNITY_STATE_LABELS[opportunity.state]} tone={STATE_TONES[opportunity.state]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{opportunity.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {opportunity.titleEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {formatDateTime(opportunity.startsAt)} to {formatDateTime(opportunity.endsAt)} · {areaText(opportunity.areaKey, areaNames, 'en')}
        </p>
      </header>

      <Feedback done={one(query.done)} />

      {opportunity.state === 'cancelled' && opportunity.cancelReason ? (
        <p className="rounded-xl border border-error bg-error-bg px-4 py-3 text-sm text-error">
          <span className="font-semibold">! Cancelled.</span> Reason sent to everyone who offered: {opportunity.cancelReason}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="offers" title="Offers to help" intro="No phone numbers are shown. Skills, availability and travel area appear only where the volunteer agreed to share them with coordinators.">
            <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface px-2 py-3 text-sm">
              <Stat label="Places">{opportunity.places}</Stat>
              <Stat label="Confirmed">{opportunity.confirmed}</Stat>
              <Stat label="Waiting">{opportunity.waiting}</Stat>
            </dl>
            {offers.length === 0 ? <p className="text-sm text-muted">No one has offered to help yet.</p> : null}
            {waitingOffers.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {waitingOffers.map((offer) => (
                  <li key={offer.id} className="flex flex-col gap-3 rounded-lg border border-line p-3">
                    <OfferSummary offer={offer} skillName={skillName} />
                    <OfferDecisionForm opportunityId={opportunity.id} offerId={offer.id} placesLeft={placesLeft} />
                  </li>
                ))}
              </ul>
            ) : null}
            {otherOffers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">Decided and withdrawn offers</h3>
                <ul className="flex flex-col divide-y divide-line">
                  {otherOffers.map((offer) => (
                    <li key={offer.id} className="py-3">
                      <OfferSummary offer={offer} skillName={skillName} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          <Section id="details" title="What members see">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Pair label="Role" ta={opportunity.roleTa} en={opportunity.roleEn} />
              <Pair label="Team" ta={opportunity.teamTa} en={opportunity.teamEn} />
              <Pair label="Place" ta={opportunity.placeTa} en={opportunity.placeEn} />
              <Pair label="What to bring" ta={opportunity.bringTa} en={opportunity.bringEn} />
              <div className="sm:col-span-2">
                <Pair label="Description" ta={opportunity.descriptionTa} en={opportunity.descriptionEn} />
              </div>
              <div>
                <dt className="text-xs text-muted">Skills needed</dt>
                <dd className="mt-1 text-text">
                  {opportunity.skills.length === 0
                    ? 'Any'
                    : opportunity.skills.map((key) => skillName(key)?.nameEn ?? key).join(', ')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Linked event</dt>
                <dd className="mt-1 text-text">
                  {opportunity.eventId ? (
                    <Link href={`/events/${opportunity.eventId}`} className="font-semibold text-primary underline">
                      Open the event
                    </Link>
                  ) : (
                    'None'
                  )}
                </dd>
              </div>
            </dl>
          </Section>

          {opportunity.state !== 'cancelled' ? (
            <Section id="edit" title="Change the opportunity" intro="Area, skills and the linked event are fixed once it is saved. Changing the times is checked again: the start must still be ahead.">
              <OpportunityForm opportunityId={opportunity.id} current={current} />
            </Section>
          ) : null}
        </div>

        <aside aria-label="State" className="flex flex-col gap-4">
          <OpportunityMoves opportunityId={opportunity.id} state={opportunity.state} waiting={opportunity.waiting} confirmed={opportunity.confirmed} />
          <p className="text-xs text-muted">Created {formatDateTime(opportunity.createdAt)}</p>
        </aside>
      </div>
    </>
  );
}

function OfferSummary({ offer, skillName }: { offer: VolunteerOfferCard; skillName: (key: string) => VolunteerSkill | undefined }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text">{offer.volunteerName}</span>
        <span className="font-mono text-xs text-muted">{offer.memberCode}</span>
        <BilingualTag label={OFFER_STATE_LABELS[offer.state] ?? { ta: offer.state, en: offer.state }} tone={OFFER_TONES[offer.state] ?? 'neutral'} />
        <span className="font-mono text-xs text-muted">{offer.offerRef}</span>
      </div>
      {offer.skills || offer.availability || offer.travelArea ? (
        <dl className="grid gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted">Skills</dt>
            <dd className="text-text">{(offer.skills ?? []).map((key) => skillName(key)?.nameEn ?? key).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Available</dt>
            <dd className="text-text">{(offer.availability ?? []).map((key) => AVAILABILITY_LABELS[key]?.en ?? key).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Travels</dt>
            <dd className="text-text">{offer.travelArea ? (TRAVEL_LABELS[offer.travelArea]?.en ?? offer.travelArea) : '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-muted">No skills profile shared with coordinators.</p>
      )}
      {offer.roleEn || offer.meetingPointEn ? (
        <p className="text-xs text-text">
          {offer.roleEn ? `Role: ${offer.roleEn}` : ''}
          {offer.roleEn && offer.meetingPointEn ? ' · ' : ''}
          {offer.meetingPointEn ? `Meeting point: ${offer.meetingPointEn}` : ''}
        </p>
      ) : null}
      {offer.decisionReason ? <p className="text-xs text-muted">Reason: {offer.decisionReason}</p> : null}
      <p className="text-xs tabular-nums text-muted">Offered {formatDateTime(offer.createdAt)}</p>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="text-lg font-bold text-text">
          {title}
        </h2>
        {intro ? <p className="text-sm text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Pair({ label, ta, en }: { label: string; ta: string; en: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 flex flex-col gap-1">
        <span lang="ta" className="whitespace-pre-wrap text-text">
          {ta}
        </span>
        <span lang="en" className="whitespace-pre-wrap text-muted">
          {en}
        </span>
      </dd>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-text">{children}</dd>
    </div>
  );
}
