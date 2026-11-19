import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACTIVITY_LABELS,
  COMMITTEE_TARGETS,
  ROLES,
  ROLE_LABELS,
  STATES,
  STATE_LABELS,
  WING_LABELS,
  WING_TYPES,
  readCommitteeArea,
  readCommitteeDecision,
  readProposal,
  readRoleGrant,
} from './forms.ts';
import { countText } from './diaspora.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const WING = {
  kind: 'wing',
  wingType: 'farmers',
  nameTa: 'விவசாயிகள் அணி',
  nameEn: "Farmers' wing",
  purposeTa: 'நீர், விதை, நியாய விலைக்காக ஒன்றிணையும் விவசாயிகள்.',
  purposeEn: 'Farmers organising for water, seed and fair prices.',
  area: 'province:LK4',
};

test('committees and wings is a built module and no longer planned', () => {
  const registered = builtModules.find((m) => m.href === '/committees');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['roles.assign', 'system.configure', 'events.manage']);
  assert.match(registered.ta, /[஀-௿]/);
  assert.equal(plannedModules.some((m) => /committee/i.test(m.name)), false);
  for (const wing of WING_TYPES) assert.match(WING_LABELS[wing].ta, /[஀-௿]/, wing);
  for (const state of STATES) assert.match(STATE_LABELS[state].ta, /[஀-௿]/, state);
  for (const role of ROLES) assert.match(ROLE_LABELS[role].ta, /[஀-௿]/, role);
  for (const [, words] of ACTIVITY_LABELS) assert.match(words.ta, /[஀-௿]/, words.en);
});

test('a wing is proposed with its name and purpose in both languages and its area (FR-COM-001)', () => {
  const { input, problems } = readProposal(form(WING));
  assert.deepEqual(problems, []);
  assert.deepEqual(input.area, { level: 'province', code: 'LK4' });
  assert.equal(input.wingId, null);

  const missing = readProposal(form({ kind: 'wing', wingType: 'farmers', nameTa: 'அ', nameEn: '', purposeTa: '', purposeEn: '', area: '' }));
  assert.equal(missing.input, null);
  assert.deepEqual(missing.problems, ['name_required', 'committee_purpose_required', 'area_required']);
  for (const problem of missing.problems) assert.ok(targetOf(COMMITTEE_TARGETS, problem), problem);
});

test('a committee names its wing; a platform-wide or typed area is read', () => {
  const noWing = readProposal(form({ ...WING, kind: 'committee' }));
  assert.deepEqual(noWing.problems, ['wing_required']);
  const withWing = readProposal(form({ ...WING, kind: 'committee', wingId: '3f0c4c4e-8a51-4d5c-9b6f-0e0f6c1e2a11', area: 'other', areaOther: 'district:LK41' }));
  assert.deepEqual(withWing.input.area, { level: 'district', code: 'LK41' });
  assert.equal(withWing.input.wingId, '3f0c4c4e-8a51-4d5c-9b6f-0e0f6c1e2a11');
  assert.deepEqual(readCommitteeArea('platform'), { level: 'platform', code: null });
  assert.equal(readCommitteeArea('country:LK'), null);
});

test('a rejection needs a reason; a role grant needs a member code and a role (FR-COM-003)', () => {
  assert.deepEqual(readCommitteeDecision(form({ decision: 'approve' })).input, { approve: true, reason: null });
  assert.deepEqual(readCommitteeDecision(form({ decision: 'reject' })).problems, ['reason_required']);
  assert.deepEqual(readCommitteeDecision(form({})).problems, ['decision_required']);
  assert.deepEqual(readRoleGrant(form({ memberCode: 'TMK-000123', role: 'coordinator' })).input, { memberCode: 'TMK-000123', role: 'coordinator' });
  assert.deepEqual(readRoleGrant(form({ memberCode: '', role: 'chair' })).problems, ['member_code_required', 'committee_role_required']);
});

test('every committee problem and confirmation has words in Tamil and English', () => {
  for (const code of [
    'wing_required', 'wing_not_active', 'wing_type_mismatch', 'outside_wing_area', 'wing_has_open_committees', 'name_required',
    'committee_purpose_required', 'committee_kind_required', 'committee_role_required', 'unknown_member', 'member_code_required',
    'already_has_role', 'last_coordinator', 'committee_not_open',
  ]) {
    const words = bilingualProblemText(code);
    assert.match(words.ta, /[஀-௿]/, code);
    assert.notEqual(words.en, code.replace(/_/g, ' '), code);
  }
  for (const done of ['committee_proposed', 'committee_approved', 'committee_rejected', 'committee_closed', 'committee_role_granted',
    'committee_member_removed', 'diaspora_event_listed', 'diaspora_event_unlisted']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});

test('small diaspora counts stay hidden and the pages never show committee content or a payment path', async () => {
  assert.equal(countText(null), 'fewer than 5');
  assert.equal(countText(12), '12');
  const detail = await readSrc('app/(staff)/committees/[id]/page.tsx');
  assert.doesNotMatch(detail, /getCommitteeSpace|getCommitteeManage/); // RB-08: administrators see the roster and counts only
  const diaspora = await readSrc('app/(staff)/committees/diaspora/page.tsx');
  assert.match(diaspora, /OD-40/);
  assert.doesNotMatch(diaspora, /contribution(s)?\s*=|createContribution|payment_method/i);
});
