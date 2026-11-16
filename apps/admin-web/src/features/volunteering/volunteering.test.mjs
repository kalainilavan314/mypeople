import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  OPPORTUNITY_MOVES,
  OPPORTUNITY_STATE_LABELS,
  VOLUNTEER_TARGETS,
  byName,
  readMove,
  readOfferDecision,
  readOpportunity,
  readOpportunityUpdate,
} from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const EVENT = '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c';
const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

const TEXT = {
  titleTa: 'நூலகச் சுத்திகரிப்பு', titleEn: 'Library clean-up',
  roleTa: 'உதவியாளர்', roleEn: 'Helper',
  descriptionTa: 'நூலகத்தைச் சுத்தம் செய்தல்.', descriptionEn: 'Clean the public library.',
  placeTa: 'யாழ் நூலகம்', placeEn: 'Jaffna library',
  bringTa: 'கையுறை', bringEn: 'Gloves',
  teamTa: 'இளைஞர் அணி', teamEn: 'Youth team',
};

test('volunteering opportunities is a built module for volunteers.manage, linked with event duty assignments', async () => {
  const registered = builtModules.find((m) => m.href === '/volunteering');
  assert.ok(registered);
  assert.equal(registered.permission, 'volunteers.manage');
  assert.equal(registered.ta, 'தன்னார்வ வாய்ப்புகள்');
  assert.equal(registered.en, 'Volunteering opportunities');
  assert.match(await readSrc('app/(staff)/volunteer-assignments/page.tsx'), /href="\/volunteering"/);
  assert.match(await readSrc('features/volunteering/VolunteeringNav.tsx'), /'\/volunteer-assignments'/);
});

test('a new opportunity needs every text in both languages, times, places and an area', () => {
  const { input, problems } = readOpportunity(form({ titleTa: 'நூலகம்', startsAt: '2026-12-01T09:00', endsAt: '2026-12-01T08:00' }));
  assert.equal(input, null);
  assert.deepEqual(problems, [
    'title_required', 'role_required', 'description_required', 'place_required', 'bring_required', 'team_required',
    'ends_before_start', 'places_required', 'area_required',
  ]);
  for (const problem of problems) assert.ok(VOLUNTEER_TARGETS[problem], `${problem} points at a field`);
});

test('a complete opportunity becomes the API input, in Sri Lankan time, with skills and the linked event', () => {
  const { input, problems } = readOpportunity(
    form({ ...TEXT, startsAt: '2026-12-01T09:00', endsAt: '2026-12-01T12:30', places: '12', area: 'ds:DS12', skills: ['first_aid', 'driving', 'first_aid'], eventId: EVENT }),
  );
  assert.deepEqual(problems, []);
  assert.equal(input.startsAt, '2026-12-01T03:30:00.000Z');
  assert.equal(input.endsAt, '2026-12-01T07:00:00.000Z');
  assert.equal(input.places, 12);
  assert.deepEqual(input.area, { level: 'ds', code: 'DS12' });
  assert.deepEqual(input.skills, ['first_aid', 'driving']);
  assert.equal(input.eventId, EVENT);
  assert.equal(input.titleTa, TEXT.titleTa);
});

test('places are 1 to 500 and skills at most 10', () => {
  const base = { ...TEXT, startsAt: '2026-12-01T09:00', endsAt: '2026-12-01T12:30', area: 'gn:GN1' };
  assert.deepEqual(readOpportunity(form({ ...base, places: '0' })).problems, ['places_required']);
  assert.deepEqual(readOpportunity(form({ ...base, places: '501' })).problems, ['places_required']);
  const many = Array.from({ length: 11 }, (_, i) => `skill_${i}`);
  assert.deepEqual(readOpportunity(form({ ...base, places: '3', skills: many })).problems, ['too_many_skills']);
  assert.deepEqual(readOpportunity(form({ ...base, places: '3', area: 'platform:' })).problems, ['area_required']);
});

test('an update sends the times only when they changed, so a running opportunity can still be corrected', () => {
  const same = readOpportunityUpdate(
    form({ ...TEXT, places: '5', startsAt: '2026-12-01T09:00', endsAt: '2026-12-01T12:00', startsAtWas: '2026-12-01T09:00', endsAtWas: '2026-12-01T12:00' }),
  );
  assert.equal('startsAt' in same.input, false);
  assert.equal(same.input.places, 5);
  const moved = readOpportunityUpdate(
    form({ ...TEXT, places: '5', startsAt: '2026-12-02T09:00', endsAt: '2026-12-02T12:00', startsAtWas: '2026-12-01T09:00', endsAtWas: '2026-12-01T12:00' }),
  );
  assert.equal(moved.input.startsAt, '2026-12-02T03:30:00.000Z');
});

test('confirming needs the meeting point in both languages; declining needs a reason (FR-VOL-006)', () => {
  assert.deepEqual(readOfferDecision(form({ decision: 'confirm', meetingPointEn: 'Main gate' })).problems, ['meeting_point_required']);
  assert.deepEqual(readOfferDecision(form({ decision: 'decline' })).problems, ['reason_required']);
  assert.deepEqual(readOfferDecision(form({})).problems, ['decision_required']);
  assert.deepEqual(readOfferDecision(form({ decision: 'confirm', meetingPointTa: 'பிரதான வாயில்', meetingPointEn: 'Main gate', roleEn: '' })).input, {
    confirm: true,
    meetingPointTa: 'பிரதான வாயில்',
    meetingPointEn: 'Main gate',
    roleTa: null,
    roleEn: null,
  });
  assert.equal(VOLUNTEER_TARGETS.meeting_point_required, 'meetingPointTa');
});

test('cancelling needs the reason everyone who offered is told; moves follow the API', () => {
  assert.deepEqual(readMove(form({ state: 'cancelled' })).problems, ['reason_required']);
  assert.deepEqual(readMove(form({ state: 'cancelled', reason: 'Rain' })).input, { state: 'cancelled', reason: 'Rain' });
  assert.deepEqual(readMove(form({ state: 'open' })).input, { state: 'open' });
  assert.deepEqual(OPPORTUNITY_MOVES.draft, ['open', 'cancelled']);
  assert.deepEqual(OPPORTUNITY_MOVES.closed, ['open', 'cancelled']);
  assert.deepEqual(OPPORTUNITY_MOVES.cancelled, []);
  for (const state of Object.keys(OPPORTUNITY_MOVES)) assert.match(OPPORTUNITY_STATE_LABELS[state].ta, /[஀-௿]/, state);
});

test('volunteers are listed by name, never ranked', () => {
  assert.deepEqual(byName([{ name: 'kumar' }, { name: 'Anitha' }, { name: 'Bala' }]).map((v) => v.name), ['Anitha', 'Bala', 'kumar']);
});

test('no phone number is ever rendered on the volunteering pages, and the list says so', async () => {
  const sources = await Promise.all(
    [
      'app/(staff)/volunteering/page.tsx',
      'app/(staff)/volunteering/[id]/page.tsx',
      'app/(staff)/volunteering/inbox/page.tsx',
      'app/(staff)/volunteering/volunteers/page.tsx',
      'features/volunteering/OfferDecisionForm.tsx',
    ].map(readSrc),
  );
  for (const source of sources) assert.doesNotMatch(source, /\.phone|phoneNumber|mobileNumber|tel:/i);
  const list = await readSrc('app/(staff)/volunteering/volunteers/page.tsx');
  assert.match(list, /No phone numbers and no rankings are shown/);
  assert.match(list, /byName\(/);
});

test('cancelling says everyone who offered will be told', async () => {
  assert.match(await readSrc('features/volunteering/OpportunityMoves.tsx'), /Everyone who offered is told/);
});

test('volunteering refusals, problems and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('volunteer_refused').ta, /[஀-௿]/);
  for (const problem of [
    'starts_in_past', 'ends_before_start', 'unknown_skill', 'unknown_area', 'reason_required', 'meeting_point_required',
    'places_filled', 'not_awaiting_decision', 'already_answered', 'title_required', 'places_required', 'area_required',
    'too_many_skills', 'answer_required',
  ]) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  assert.match(bilingualProblemText('not_allowed_from:cancelled').en, /cancelled/);
  for (const code of ['outside_your_area', 'own_record']) assert.match(bilingualMessageFor(code).ta, /[஀-௿]/, code);
  for (const done of ['opportunity_created', 'opportunity_saved', 'opportunity_open', 'opportunity_closed', 'opportunity_cancelled', 'offer_confirmed', 'offer_declined', 'contact_answered']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
