import test from 'node:test';
import assert from 'node:assert/strict';

import { readCloseForm, readNoticeForm, readPeriodForm } from './forms.ts';
import { areaKeyText, overlapRefs, silenceStatus } from './periods.ts';
import { en } from '../../lib/i18n/en.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { bilingualMessageFor, bilingualProblemText, problemTargetField } from '../../lib/messages.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const PERIOD = {
  electionType: 'provincial',
  titleEn: 'Northern Provincial Council election',
  titleTa: 'வட மாகாண சபைத் தேர்தல்',
  areaLevel: 'province',
  areaCode: 'lk4',
  startsAt: '2026-11-10T00:00',
  endsAt: '2026-12-31T23:00',
  silenceStartsAt: '2026-12-10T00:00',
  silenceEndsAt: '2026-12-13T00:00',
  pollingDay: '2026-12-12',
  sourceUrl: 'https://elections.gov.lk/gazette/2401-12',
  sourceReference: 'Gazette 2401/12',
  sourcePublishedAt: '2026-11-01T09:00',
  confirm: '1',
};

test('election mode is a built module needing election.mode.manage, and no longer planned (D22)', () => {
  const registered = builtModules.find((m) => m.href === '/elections');
  assert.ok(registered);
  assert.equal(registered.permission, 'election.mode.manage');
  assert.match(registered.ta, /[\u0B80-\u0BFF]/);
  // Election mode is official information and silence controls, never party polls or voting.
  assert.equal(plannedModules.some((m) => /election/i.test(m.name) || /party polls/i.test(m.desc)), false);
});

test('a complete declare form becomes the API input in UTC, with the area code upper-cased', () => {
  const { input, problems } = readPeriodForm(form(PERIOD));
  assert.deepEqual(problems, []);
  assert.equal(input.area.level, 'province');
  assert.equal(input.area.code, 'LK4');
  // Sri Lanka is UTC+05:30: midnight on 10 Nov is 18:30 UTC on 9 Nov.
  assert.equal(input.startsAt, '2026-11-09T18:30:00.000Z');
  assert.equal(input.pollingDay, '2026-12-12');
});

test('the whole country sends no area code', () => {
  const { input } = readPeriodForm(form({ ...PERIOD, areaLevel: 'platform', areaCode: 'LK4' }));
  assert.equal(input.area.code, null);
});

test('declare form problems are named and point at their fields', () => {
  const { input, problems } = readPeriodForm(
    form({ ...PERIOD, electionType: 'party_poll', titleTa: '', areaCode: '', sourceUrl: 'http://example.org', silenceEndsAt: '', confirm: '' }),
  );
  assert.equal(input, null);
  assert.deepEqual(problems.sort(), [
    'area_code_required',
    'confirmation_required',
    'election_type_required',
    'silence_ends_at_required',
    'source_url_https',
    'title_ta_required',
  ]);
  for (const problem of problems) assert.ok(problemTargetField(problem), `${problem} must link to a field`);
});

test('an ID number in public election text is refused', () => {
  const { problems } = readNoticeForm(form({ source: 'party', titleEn: 'Notice', titleTa: 'அறிவிப்பு', bodyEn: 'Contact 199012345678', bodyTa: 'உரை' }));
  assert.ok(problems.includes('contains_id_number'));
});

test('a party notice needs no source details; empty optional fields go as null', () => {
  const { input, problems } = readNoticeForm(form({ source: 'party', titleEn: 'Meeting', titleTa: 'கூட்டம்', bodyEn: 'Text', bodyTa: 'உரை' }));
  assert.deepEqual(problems, []);
  assert.equal(input.sourceUrl, null);
  assert.equal(input.documentReference, null);
  assert.equal(input.sourcePublishedAt, null);
});

test('a notice must carry one of the two FR-ELX-004 labels', () => {
  const { input, problems } = readNoticeForm(form({ source: 'campaign', titleEn: 'A', titleTa: 'அ', bodyEn: 'B', bodyTa: 'ஆ' }));
  assert.equal(input, null);
  assert.deepEqual(problems, ['notice_source_required']);
});

test('closing needs an action, a 3 to 500 character reason and the confirmation', () => {
  assert.deepEqual(readCloseForm(form({ closeAction: 'end', reason: 'Polling finished', confirm: '1' })).input, { action: 'end', reason: 'Polling finished' });
  assert.deepEqual(readCloseForm(form({ closeAction: 'delete', reason: 'no', confirm: '' })).problems, [
    'close_action_required',
    'reason_required',
    'confirmation_required',
  ]);
});

test('silence status follows the period state and the clock', () => {
  const period = { state: 'declared', silenceStartsAt: '2026-12-09T18:30:00Z', silenceEndsAt: '2026-12-12T18:30:00Z' };
  assert.equal(silenceStatus(period, new Date('2026-12-01T00:00:00Z')), 'upcoming');
  assert.equal(silenceStatus(period, new Date('2026-12-11T00:00:00Z')), 'active');
  assert.equal(silenceStatus(period, new Date('2026-12-13T00:00:00Z')), 'over');
  assert.equal(silenceStatus({ ...period, state: 'ended' }, new Date('2026-12-11T00:00:00Z')), 'stopped');
});

test('only period references are read from the overlap warning in the address', () => {
  assert.deepEqual(overlapRefs('EP-0001,EP-0042'), ['EP-0001', 'EP-0042']);
  assert.deepEqual(overlapRefs('<script>,EP-0003,anything'), ['EP-0003']);
  assert.deepEqual(overlapRefs(undefined), []);
});

test('areas read in words', () => {
  assert.equal(areaKeyText('platform', en.elections), 'Whole country');
  assert.equal(areaKeyText('district:LK41', en.elections), 'District LK41');
});

test('the API refusals of D22 read as words in both languages', () => {
  for (const code of ['election_invalid', 'already_withdrawn', 'invalid_request']) {
    assert.match(bilingualMessageFor(code).ta, /[\u0B80-\u0BFF]/, code);
  }
  assert.match(bilingualMessageFor('not_allowed_from:ended').en, /ended/);
  for (const problem of ['silence_must_cover_polling_day', 'silence_outside_period', 'official_source_required', 'source_in_future']) {
    const text = bilingualProblemText(problem);
    assert.match(text.ta, /[\u0B80-\u0BFF]/, problem);
    assert.notEqual(text.en, problem.replace(/_/g, ' '), problem);
  }
});
