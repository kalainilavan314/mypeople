import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { REPORT_ENTRY_LABELS, REPORT_LABELS, ROSTER_TARGETS, memberCodeFrom, readShift, reportEntryLabel } from './roster.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const PERIOD = '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('a shift needs role and site in both languages, times, 1 to 200 places and an area', () => {
  const { problems } = readShift(form({ roleEn: 'Polling agent', startsAt: '2026-12-05T08:00', endsAt: '2026-12-05T07:00', places: '201' }), PERIOD);
  assert.deepEqual(problems, ['role_required', 'site_required', 'ends_before_start', 'shift_places_required', 'area_required']);
  for (const problem of problems) assert.ok(targetOf(ROSTER_TARGETS, problem), problem);
  const { input } = readShift(
    form({ roleTa: 'வாக்குச்சாவடி முகவர்', roleEn: 'Polling agent', siteTa: 'யாழ் இந்துக் கல்லூரி', siteEn: 'Jaffna Hindu College', startsAt: '2026-12-05T06:00', endsAt: '2026-12-05T16:00', places: '4', area: 'gn:G12' }),
    PERIOD,
  );
  assert.equal(input.periodId, PERIOD);
  assert.equal(input.startsAt, '2026-12-05T00:30:00.000Z');
  assert.deepEqual(input.area, { level: 'gn', code: 'G12' });
});

test('member IDs are read as printed on the card', () => {
  assert.equal(memberCodeFrom(form({ memberCode: ' mp-00012 ' })), 'MP-00012');
  assert.equal(memberCodeFrom(form({ memberCode: 'a b' })), null);
});

test('the period page shows the FR-ELX-009 report and links to the roster', async () => {
  const page = await readSrc('app/(staff)/elections/[id]/page.tsx');
  assert.match(page, /getElectionPeriodReport\(periodId\)/);
  assert.match(page, /\/elections\/\$\{period\.id\}\/roster/);
  assert.equal(REPORT_LABELS.length, 7);
  for (const item of REPORT_LABELS) assert.match(item.ta, /[஀-௿]/, item.key);
});

test('roster refusals and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('roster_refused').ta, /[஀-௿]/);
  for (const problem of ['site_required', 'shift_places_required', 'message_required', 'period_not_declared', 'outside_the_election_area', 'shift_cancelled', 'member_outside_shift_area', 'already_offered', 'places_filled', 'member_not_found', 'membership_not_active']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of ['roster_shift_created', 'roster_offered', 'roster_shift_cancelled', 'roster_message_sent']) assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
});

test('the period page lists the entries behind the report, ids only, with Tamil and English words', async () => {
  const page = await readSrc('app/(staff)/elections/[id]/page.tsx');
  assert.match(page, /listElectionPeriodReportEntries\(periodId\)/);
  for (const action of ['gallery.album.published', 'promise.published', 'scorecard.published', 'messaging.broadcast.sent', 'election.roster.shift_created']) {
    assert.match(REPORT_ENTRY_LABELS[action].ta, /[஀-௿]/, action);
  }
  assert.deepEqual(reportEntryLabel('something.new'), { ta: 'something.new', en: 'something.new' });
});

test('the shift page lists the messages already sent to its volunteers', async () => {
  const page = await readSrc('app/(staff)/elections/[id]/roster/[shift]/page.tsx');
  assert.match(page, /shift\.messages\.map/);
  assert.doesNotMatch(page, /everyone offered or accepted/);
});
