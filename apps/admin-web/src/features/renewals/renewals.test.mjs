import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CERTIFICATE_TARGETS,
  KINDS,
  KIND_LABELS,
  PHASES,
  PHASE_LABELS,
  STATUSES,
  STATUS_LABELS,
  oneOf,
  readIssue,
  readReason,
  searchRef,
} from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const TAMIL = /[஀-௿]/;
const EVENT = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';

test('renewals and certificates is a built module for certificate.issue_revoke holders (D25, PRM-52)', () => {
  const registered = builtModules.find((m) => m.href === '/renewals');
  assert.ok(registered);
  assert.equal(registered.permission, 'certificate.issue_revoke');
  assert.match(registered.ta, TAMIL);
  for (const phase of PHASES) assert.match(PHASE_LABELS[phase].ta, TAMIL, phase);
  for (const kind of KINDS) assert.match(KIND_LABELS[kind].ta, TAMIL, kind);
  for (const status of STATUSES) assert.match(STATUS_LABELS[status].ta, TAMIL, status);
  assert.equal(PHASES.includes('confirmed'), false); // the API lists only these four
});

test('issuing needs a member ID and a kind, and an event for an event certificate', () => {
  assert.deepEqual(readIssue(form({ memberCode: 'NPM-00042', kind: 'membership' })), {
    input: { memberCode: 'NPM-00042', kind: 'membership' },
    problems: [],
  });
  assert.deepEqual(readIssue(form({ memberCode: 'NPM-00042', kind: 'event_participation', eventId: EVENT })).input, {
    memberCode: 'NPM-00042',
    kind: 'event_participation',
    eventId: EVENT,
  });
  // An event id is sent only for an event certificate.
  assert.deepEqual(readIssue(form({ memberCode: 'NPM-00042', kind: 'volunteer_service', eventId: EVENT })).input, {
    memberCode: 'NPM-00042',
    kind: 'volunteer_service',
  });
  assert.deepEqual(readIssue(form({ memberCode: 'NPM-00042', kind: 'event_participation', eventId: 'not-an-id' })).problems, [
    'certificate_event_required',
  ]);
  assert.deepEqual(readIssue(form({ memberCode: ' ', kind: 'nic_card' })).problems, ['member_code_required', 'kind_required']);
});

test('revoking and reissuing always carry a reason of 3 to 500 characters (FR-RNW-008)', () => {
  assert.deepEqual(readReason(form({ reason: '  Issued to the wrong member  ' })), { input: 'Issued to the wrong member', problems: [] });
  assert.deepEqual(readReason(form({ reason: 'no' })), { input: null, problems: ['reason_required'] });
  assert.deepEqual(readReason(form({ reason: 'x'.repeat(501) })), { input: null, problems: ['reason_required'] });
});

test('filters accept only known values and a plain reference', () => {
  assert.equal(oneOf(PHASES, 'grace'), 'grace');
  assert.equal(oneOf(PHASES, 'confirmed'), undefined);
  assert.equal(oneOf(STATUSES, 'revoked'), 'revoked');
  assert.equal(searchRef(' CT-000012 '), 'CT-000012');
  assert.equal(searchRef("CT-1'; drop"), undefined);
  assert.equal(searchRef(''), undefined);
});

test('every refusal and confirmation has its words in both languages', () => {
  for (const problem of ['member_code_required', 'certificate_event_required', 'already_issued', 'no_attendance_recorded', 'no_completed_assignments', 'reason_required']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, TAMIL, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
    assert.ok(targetOf(CERTIFICATE_TARGETS, problem), problem);
  }
  assert.match(bilingualProblemText('already_issued').en, /reissue/i);
  for (const code of ['certificate_refused', 'witnessed_by_you']) assert.match(bilingualMessageFor(code).ta, TAMIL, code);
  for (const done of ['certificate_issued', 'certificate_revoked', 'certificate_reissued']) assert.match(bilingualConfirmation(done).ta, TAMIL, done);
});

test('the pages never show an ID number and the review page shows assisted sessions without a witness name', async () => {
  const list = await readSrc('app/(staff)/renewals/page.tsx');
  const detail = await readSrc('app/(staff)/renewals/certificates/[ref]/page.tsx');
  const review = await readSrc('app/(staff)/verification/[id]/page.tsx');
  for (const source of [list, detail]) assert.doesNotMatch(source, /\bnic(Number|Hash)?\b|passportNumber/);
  assert.match(review, /listAssistedSessionsForReview/);
  assert.match(review, /witnessTier/);
  assert.doesNotMatch(review, /witnessId|witnessName/);
});
