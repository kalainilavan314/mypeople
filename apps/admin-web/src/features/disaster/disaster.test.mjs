import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HAZARDS,
  HAZARD_LABELS,
  RELIEF_TARGETS,
  SAFETY_TARGETS,
  SEVERITIES,
  SEVERITY_LABELS,
  readDistribution,
  readRefresh,
  readRelay,
  readShelter,
  readSupply,
  readTargets,
} from './forms.ts';
import { readDecision, readPartner, readRequest, stateKey, BLOOD_TARGETS } from '../blood-requests/forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const item of value) data.append(name, item);
    else data.set(name, value);
  }
  return data;
}

const ITEMS = ['rice', 'dry_rations'];

const ALERT = {
  sourceKey: 'dmc', sourceUrl: 'https://www.dmc.gov.lk/flood/1', sourceIssuedAt: '2026-11-19T08:00', sourceEndsAt: '2026-11-20T08:00',
  hazard: 'flood', severity: 'watch', titleTa: 'வெள்ள எச்சரிக்கை', titleEn: 'Flood watch',
  bodyTa: 'ஆற்று நீர்மட்டம் உயர்கிறது.', bodyEn: 'River levels are rising.', ownAreas: ['district:LK41'], moreAreas: 'gn:LK4103025, ds:LK4103',
};

test('D26 and D27 are built modules for their permissions', () => {
  const disaster = builtModules.find((m) => m.href === '/disaster');
  const blood = builtModules.find((m) => m.href === '/blood-requests');
  assert.deepEqual([...disaster.permission], ['disaster.relay', 'relief.logistics']);
  assert.deepEqual([...blood.permission], ['donor.request', 'donor.oversight']);
  assert.match(disaster.ta, /[஀-௿]/);
  for (const key of HAZARDS) assert.match(HAZARD_LABELS[key].ta, /[஀-௿]/, key);
  for (const key of SEVERITIES) assert.match(SEVERITY_LABELS[key].ta, /[஀-௿]/, key);
});

test('a relay needs an official source, its times, both languages and target areas (FR-DIS-001, 002)', () => {
  const empty = readRelay(form({ sourceKey: 'facebook' }));
  assert.equal(empty.input, null);
  assert.deepEqual(empty.problems, [
    'unofficial_source', 'hazard_required', 'source_url_required', 'issued_required', 'ends_required', 'severity_required',
    'title_required', 'body_required', 'targets_required',
  ]);
  for (const problem of empty.problems) assert.ok(targetOf(SAFETY_TARGETS, problem), problem);
  const ok = readRelay(form(ALERT));
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.input.sourceIssuedAt, '2026-11-19T02:30:00.000Z'); // Sri Lankan time, sent in UTC
  assert.deepEqual(ok.input.targets, [
    { level: 'district', code: 'LK41' }, { level: 'gn', code: 'LK4103025' }, { level: 'ds', code: 'LK4103' },
  ]);
});

test('targets are districts, DS or GN divisions, never a province', () => {
  assert.deepEqual(readTargets(form({ moreAreas: 'province:NP' })).problems, ['target_level']);
  assert.deepEqual(readTargets(form({ moreAreas: 'nonsense' })).problems, ['target_invalid']);
  const ends = readRefresh(form({ ...ALERT, sourceEndsAt: '2026-11-19T07:00' }));
  assert.deepEqual(ends.problems, ['ends_before_issue']);
});

test('a shelter needs an authorised source and when it reported; a new one, a DS or GN division (FR-DIS-006)', () => {
  const shelter = {
    nameTa: 'மத்திய கல்லூரி', nameEn: 'Central College', placeTa: 'பிரதான வீதி', placeEn: 'Main road', status: 'open',
    sourceKey: 'district_secretariat', sourceReportedAt: '2026-11-19T08:00',
  };
  assert.deepEqual(readShelter(form({ ...shelter, sourceKey: 'meteorology' }), { needsArea: false }).problems, ['unauthorised_shelter_source']);
  assert.deepEqual(readShelter(form({ ...shelter, area: 'district:LK41' }), { needsArea: true }).problems, ['shelter_area_level']);
  assert.deepEqual(readShelter(form({ ...shelter, otherArea: 'gn:LK4103025' }), { needsArea: true }).input.area, {
    level: 'gn', code: 'LK4103025',
  });
});

test('relief records a store, an item, a quantity and a case or a group, never a name (FR-DIS-005)', () => {
  const supply = readSupply(form({ store: 'gn:X1', item: 'rice', quantity: '0', supplier: 'D', day: '' }), ITEMS);
  assert.deepEqual(supply.problems, ['store_level', 'quantity_invalid', 'supplier_required', 'date_required']);
  const base = { storeKey: 'ds:LK4103', area: 'gn:LK4103025', item: 'rice', quantity: '20', evidence: 'SL-14', day: '2026-11-19' };
  assert.deepEqual(readDistribution(form({ ...base, recipientKind: 'case', caseRef: 'Kumar' }), ITEMS).problems, ['case_ref_invalid']);
  assert.deepEqual(readDistribution(form({ ...base, recipientKind: 'group', groupSite: 'Hall' }), ITEMS).problems, ['group_details_required']);
  const ok = readDistribution(form({ ...base, recipientKind: 'case', caseRef: 'as-7kq2m4xa' }), ITEMS);
  assert.equal(ok.input.caseRef, 'AS-7KQ2M4XA');
  assert.equal(ok.input.groupSite, null);
  for (const problem of ['case_not_found', 'more_than_in_stock', 'outside_store_area']) assert.ok(targetOf(RELIEF_TARGETS, problem), problem);
});

test('blood requests come with a group, a broad area, units, urgency and a time (FR-BLD-003)', () => {
  assert.deepEqual(readRequest(form({})).problems, [
    'blood_group_required', 'area_required', 'units_invalid', 'urgency_required', 'needed_by_required',
  ]);
  const ok = readRequest(form({ bloodGroup: 'O-', districtCode: 'LK41', dsCode: 'LK4103', units: '2', urgency: 'critical', neededBy: '2026-11-20T10:00' }));
  assert.deepEqual(ok.input.area, { level: 'ds', code: 'LK4103' });
  assert.deepEqual(readPartner(form({ name: 'NB', kind: 'clinic' })).problems, [
    'partner_name_required', 'partner_kind_required', 'district_required', 'agreement_required',
  ]);
  assert.deepEqual(readDecision(form({ decision: 'refuse' })).problems, ['reason_required']);
  assert.equal(readDecision(form({ decision: 'approve' })).input.approve, true);
  assert.equal(stateKey('open', true), 'expired');
  for (const problem of ['needed_by_in_past', 'identity_not_verified', 'own_request']) {
    assert.ok(targetOf(BLOOD_TARGETS, problem) || bilingualProblemText(problem).en !== problem.replace(/_/g, ' '), problem);
  }
});

test('every new refusal, problem and confirmation has words in both languages', () => {
  for (const code of ['safety_refused', 'relief_refused', 'donor_refused', 'not_partner_requester']) {
    assert.match(bilingualMessageFor(code).ta, /[஀-௿]/, code);
  }
  for (const problem of ['link_not_from_source', 'more_than_in_stock', 'case_not_found', 'own_request', 'needed_by_too_far']) {
    assert.match(bilingualProblemText(problem).ta, /[஀-௿]/, problem);
  }
  for (const done of ['alert_relayed', 'relief_to_group', 'blood_request_raised', 'blood_requester_authorised']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
