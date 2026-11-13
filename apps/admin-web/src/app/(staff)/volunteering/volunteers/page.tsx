import { ApiError, type VolunteerCard, type VolunteerSkill } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { AVAILABILITY_LABELS, TRAVEL_LABELS, byName } from '@/features/volunteering/forms';
import { VolunteeringNav } from '@/features/volunteering/VolunteeringNav';
import { api } from '@/lib/api';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'The volunteer list needs the volunteer management permission (volunteers.manage).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FR-VOL-003, BR-043: volunteers who agreed to share their skills with coordinators, by name. */
export default function VolunteersPage(props: PageProps<'/volunteering/volunteers'>) {
  return (
    <>
      <PageHeader ta="திறன்களின்படி தன்னார்வலர்கள்" en="Volunteers by skill" />
      <VolunteeringNav current="/volunteering/volunteers" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <VolunteerList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function VolunteerList({ searchParams }: { searchParams: PageProps<'/volunteering/volunteers'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const client = await staffApi();

  let skills: VolunteerSkill[];
  try {
    skills = (await client.getVolunteerSkills()).skills;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Volunteering is not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The skills list is not available." />;
  }
  const requested = one(query.skill);
  const skill = skills.find((item) => item.key === requested);

  let cards: VolunteerCard[];
  try {
    cards = byName(await client.listVolunteers(skill?.key));
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The volunteer list is not available." />;
  }
  const skillName = (key: string) => skills.find((item) => item.key === key)?.nameEn ?? key;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-text">
        <span lang="ta" className="block font-semibold">
          தொலைபேசி இலக்கங்களோ தரவரிசைகளோ காட்டப்படுவதில்லை.
        </span>
        <span lang="en" className="block">
          No phone numbers and no rankings are shown. Only members who agreed to share their skills with coordinators appear, sorted by
          name.
        </span>
      </p>

      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label htmlFor="volunteer-skill" className="flex min-w-56 flex-col gap-1 text-sm font-semibold text-text">
          Skill
          <select id="volunteer-skill" name="skill" defaultValue={skill?.key ?? ''} className={`min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS}`}>
            <option value="">Any skill</option>
            {skills.map((item) => (
              <option key={item.key} value={item.key}>
                {item.nameTa} · {item.nameEn}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
          Show volunteers
        </button>
        {skill ? (
          <Link href="/volunteering/volunteers" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
            Clear filter
          </Link>
        ) : null}
      </form>

      <p className="text-xs text-muted">
        {cards.length} {cards.length === 1 ? 'volunteer' : 'volunteers'}
        {skill ? ` with ${skill.nameEn}` : ''}
      </p>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          {skill ? 'No volunteer in your areas shared this skill.' : 'No volunteer in your areas has shared a skills profile yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Volunteers who shared their skills, by name</caption>
            <thead className="border-b border-line text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Name</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Member ID</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Skills</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Available</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Travels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cards.map((card) => (
                <tr key={card.memberId}>
                  <td className="px-3 py-2 font-semibold text-text">{card.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{card.memberCode}</td>
                  <td className="px-3 py-2 text-text">{card.skills.map(skillName).join(', ')}</td>
                  <td className="px-3 py-2 text-text">{card.availability.map((key) => AVAILABILITY_LABELS[key]?.en ?? key).join(', ')}</td>
                  <td className="px-3 py-2 text-text">{TRAVEL_LABELS[card.travelArea]?.en ?? card.travelArea}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
