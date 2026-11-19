import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPOINTMENT_TARGETS,
  NEED_LABELS,
  PROFILE_STATES,
  PROFILE_STATE_LABELS,
  colomboTime,
  groupByDay,
  normalisePhone,
  profileValues,
  readFollowUp,
  readNewProfile,
  readOwnProfile,
  readProfile,
  readReason,
  readRepresentativeArea,
  readSlotSeries,
  renameProblems,
} from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const TAMIL = /[஀-௿]/;

const PROFILE = {
  roleTa: 'மாவட்ட ஒருங்கிணைப்பாளர்', roleEn: 'District Coordinator',
  displayNameTa: 'சி. குமரன்', displayNameEn: 'S. Kumaran',
  officeHoursTa: 'திங்கள் முதல் வெள்ளி, காலை 9 முதல் 12 வரை', officeHoursEn: 'Monday to Friday, 9 am to 12 noon',
};

test('representatives is a built module for profile managers and for representatives themselves', () => {
  const registered = builtModules.find((m) => m.href === '/representatives');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['appointment.profile.manage', 'appointment.manage_own']);
  assert.match(registered.ta, TAMIL);
  for (const state of PROFILE_STATES) assert.match(PROFILE_STATE_LABELS[state].ta, TAMIL, state);
  for (const need of Object.keys(NEED_LABELS)) assert.match(NEED_LABELS[need].ta, TAMIL, need);
});

test('a profile needs its role, name and office hours in both languages; contact routes are optional (FR-APT-001)', () => {
  const { input, problems } = readProfile(form(PROFILE));
  assert.deepEqual(problems, []);
  assert.equal(input.publicPhone, null);
  assert.equal(input.officeAddressEn, null);
  assert.deepEqual(readProfile(form({ ...PROFILE, roleTa: '' })).problems, ['role_required']);
  const routes = readProfile(form({ ...PROFILE, publicPhone: '021 222 3344', publicEmail: 'office@example.lk' }));
  assert.equal(routes.input.publicPhone, '0212223344');
  assert.deepEqual(readProfile(form({ ...PROFILE, publicPhone: '12345', publicEmail: 'no-at-sign' })).problems, ['phone_format', 'email_format']);
  assert.equal(normalisePhone('+94 21-222-3344'), '+94212223344');
});

test('a new profile names the person by member ID and covers a district, DS or GN division, never a province', () => {
  const made = readNewProfile(form({ ...PROFILE, memberCode: 'TMK-000123', area: 'district:LK41' }));
  assert.deepEqual(made.problems, []);
  assert.deepEqual(made.input.area, { level: 'district', code: 'LK41' });
  assert.equal(made.input.memberCode, 'TMK-000123');
  assert.deepEqual(readNewProfile(form({ ...PROFILE, memberCode: 'TMK-000123', area: 'province:NP' })).problems, ['representative_area_level']);
  assert.deepEqual(readNewProfile(form({ ...PROFILE, area: 'gn:' })).problems, ['member_code_required', 'area_required']);
  assert.equal(readRepresentativeArea('ds:LK4103').level, 'ds');
  assert.equal(targetOf(APPOINTMENT_TARGETS, 'representative_area_level'), 'area');
});

test('showing contact routes is the person’s own approval, and needs a route to show (BR-143)', () => {
  const own = readOwnProfile(form({ officeHoursTa: PROFILE.officeHoursTa, officeHoursEn: PROFILE.officeHoursEn, publicEmail: 'office@example.lk', showContacts: '1' }));
  assert.deepEqual(own.problems, []);
  assert.equal(own.input.showContacts, true);
  const hidden = readOwnProfile(form({ officeHoursTa: PROFILE.officeHoursTa, officeHoursEn: PROFILE.officeHoursEn }));
  assert.equal(hidden.input.showContacts, false);
  const nothing = readOwnProfile(form({ officeHoursTa: PROFILE.officeHoursTa, officeHoursEn: PROFILE.officeHoursEn, showContacts: '1' }));
  assert.deepEqual(nothing.problems, ['no_contacts']);
});

test('a slot series starts in Sri Lankan time, 10 to 120 minutes each, 1 to 16 of them; in person needs the place', () => {
  const { input, problems } = readSlotSeries(form({ startsAt: '2026-12-01T09:30', minutes: '30', count: '4', mode: 'in_person', placeTa: 'தமக அலுவலகம்', placeEn: 'TMK office' }));
  assert.deepEqual(problems, []);
  assert.equal(input.startsAt, '2026-12-01T04:00:00.000Z');
  assert.deepEqual([input.minutes, input.count, input.mode], [30, 4, 'in_person']);
  const phone = readSlotSeries(form({ startsAt: '2026-12-01T09:30', minutes: '20', count: '2', mode: 'phone_call', placeEn: 'ignored' }));
  assert.equal(phone.input.placeEn, null);
  const bad = readSlotSeries(form({ startsAt: 'tomorrow', minutes: '5', count: '40', mode: 'in_person' }));
  assert.deepEqual(bad.problems, ['slot_start_required', 'slot_length', 'too_many_slots', 'slot_place_required']);
});

test('a follow-up after meeting needs the note the member reads; a no-show may have none (FR-APT-006)', () => {
  assert.deepEqual(readFollowUp(form({ outcome: 'completed' })).problems, ['follow_up_note_required']);
  assert.deepEqual(readFollowUp(form({ outcome: 'completed', note: 'The water board visits on Monday.' })).input, { outcome: 'completed', note: 'The water board visits on Monday.' });
  assert.deepEqual(readFollowUp(form({ outcome: 'no_show' })).input, { outcome: 'no_show', note: null });
  assert.deepEqual(readFollowUp(form({})).problems, ['outcome_required']);
  assert.deepEqual(readReason(form({ reason: 'Called away' })).input, 'Called away');
});

test('the calendar groups slots by their Sri Lankan day, in time order', () => {
  const days = groupByDay([
    { id: 'b', startsAt: '2026-12-01T05:00:00Z' },
    { id: 'c', startsAt: '2026-12-01T19:00:00Z' },
    { id: 'a', startsAt: '2026-12-01T04:00:00Z' },
  ]);
  assert.deepEqual(days.map((day) => [day.day, day.slots.map((slot) => slot.id)]), [['2026-12-01', ['a', 'b']], ['2026-12-02', ['c']]]);
  assert.equal(colomboTime('2026-12-01T04:00:00Z'), '09:30');
});

test('a profile fills the form with text only', () => {
  const values = profileValues({ roleEn: 'Coordinator', publicPhone: null, openSlots: 3 });
  assert.equal(values.roleEn, 'Coordinator');
  assert.equal(values.publicPhone, '');
});

test('every refusal the appointments API gives has words in both languages', () => {
  const problems = [
    'unknown_member_code', 'profile_exists', 'unknown_area', 'phone_format', 'email_format', 'no_contacts', 'no_profile',
    'representative_lacks_calendar_permission', 'representative_unavailable', 'too_far_ahead', 'slot_length', 'too_many_slots',
    'overlaps_existing_slot', 'already_started', 'slot_unavailable', 'slot_taken', 'not_started_yet', 'note_too_short',
    'office_address_en_too_short', ...renameProblems(['starts_in_past', 'note_required', 'place_required']),
  ];
  for (const problem of problems) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, TAMIL, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  assert.deepEqual(renameProblems(['starts_in_past', 'slot_taken']), ['slot_starts_in_past', 'slot_taken']);
  assert.match(bilingualMessageFor('appointment_refused').ta, TAMIL);
  for (const done of ['representative_drafted', 'representative_saved', 'representative_published', 'representative_withdrawn', 'slots_added', 'slot_withdrawn', 'own_profile_saved', 'contacts_approved', 'contacts_hidden', 'booking_cancelled', 'follow_up_recorded']) {
    assert.match(bilingualConfirmation(done).ta, TAMIL, done);
  }
});
