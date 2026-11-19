import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  BUDGET_TARGETS,
  CONSULTATION_LABEL,
  DEFAULT_ELIGIBILITY,
  FUND_KINDS,
  FUND_KIND_LABELS,
  MOVES,
  MOVE_LABELS,
  PHASE_LABELS,
  REVIEW_KINDS,
  REVIEW_LABELS,
  STATUSES,
  STATUS_LABELS,
  colomboInput,
  formatRupees,
  moneyTotals,
  ownProblems,
  readCompletion,
  readCycle,
  readExpenditure,
  readMove,
  readProject,
  readReview,
  rupeesValue,
} from './forms.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const TAMIL = /[஀-௿]/;

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const CYCLE = {
  titleTa: 'கிராம நீர் 2027', titleEn: 'Village water 2027',
  descriptionTa: 'சமூக நிதி எந்தத் திட்டங்களுக்குச் செலவிடப்படும் என்பதைத் தெரிவுசெய்யுங்கள்.',
  descriptionEn: 'Choose which approved projects the community fund pays for.',
  fundKind: 'community_fund', fundSourceTa: 'சமூகத் திட்ட நிதி', fundSourceEn: 'Community projects fund',
  budget: '1,500,000', eligibilityTa: DEFAULT_ELIGIBILITY.ta, eligibilityEn: DEFAULT_ELIGIBILITY.en, maxChoices: '3',
  votingOpensAt: '2027-01-10T08:00', votingClosesAt: '2027-01-20T18:00', area: 'district:LK41',
};

test('participatory budgeting is a built module for managers, certifiers and the Treasurer, and no longer planned', () => {
  const registered = builtModules.find((m) => m.href === '/budgeting');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['pb.manage', 'pb.certify', 'finance.approve']);
  assert.match(registered.ta, TAMIL);
  assert.equal(plannedModules.some((m) => /budget/i.test(m.name)), false);
  for (const status of STATUSES) assert.match(STATUS_LABELS[status].ta, TAMIL, status);
  for (const phase of Object.keys(PHASE_LABELS)) assert.match(PHASE_LABELS[phase].ta, TAMIL, phase);
  for (const kind of FUND_KINDS) assert.match(FUND_KIND_LABELS[kind].ta, TAMIL, kind);
  for (const kind of REVIEW_KINDS) assert.match(REVIEW_LABELS[kind].ta, TAMIL, kind);
  for (const move of Object.values(MOVES).flat()) assert.match(MOVE_LABELS[move].ta, TAMIL, move);
  // FR-PBG-009: never a public election or a government budget.
  assert.match(CONSULTATION_LABEL.en, /not a public election or a government budget/);
  assert.match(CONSULTATION_LABEL.ta, TAMIL);
});

test('a cycle needs every rule in both languages, a budget, choices, voting dates and an area (FR-PBG-001)', () => {
  const { input, problems } = readCycle(form({ titleEn: 'Water', budget: '0', maxChoices: '12', votingOpensAt: '2027-01-20T08:00', votingClosesAt: '2027-01-10T08:00' }), { needsArea: true });
  assert.equal(input, null);
  assert.deepEqual(problems, [
    'title_required', 'description_required', 'fund_kind_required', 'fund_source_required', 'budget_invalid', 'eligibility_required',
    'max_choices_invalid', 'closes_before_opens', 'area_required',
  ]);
  for (const problem of problems) assert.ok(targetOf(BUDGET_TARGETS, problem), problem);
  const ok = readCycle(form(CYCLE), { needsArea: true });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.input.budget, '1500000.00');
  assert.equal(ok.input.maxChoices, 3);
  // Sri Lankan time (UTC+05:30) to UTC.
  assert.equal(ok.input.votingOpensAt, '2027-01-10T02:30:00.000Z');
  assert.deepEqual(ok.input.area, { level: 'district', code: 'LK41' });
  assert.equal('area' in readCycle(form(CYCLE), { needsArea: false }).input, false, 'the area never changes after creation');
  assert.equal(colomboInput('2027-01-10T02:30:00Z'), '2027-01-10T08:00');
});

test('rupees are read as typed and shown with separators', () => {
  assert.equal(rupeesValue('1,250,000'), '1250000.00');
  assert.equal(rupeesValue('Rs. 600000.5'), '600000.50');
  assert.equal(rupeesValue('-5'), null);
  assert.equal(rupeesValue('0'), null);
  assert.equal(rupeesValue('12.345'), null);
  assert.equal(formatRupees('1500000.00'), 'Rs. 1,500,000');
  assert.equal(formatRupees(null), '—');
  assert.deepEqual(moneyTotals([{ allocated: '900000.00', spent: '500000.00' }, { allocated: null, spent: '0' }]), { allocated: 900000, spent: 500000 });
});

test('projects come from a proposal approved for planning, in both languages, with a cost (FR-PBG-002)', () => {
  const missing = readProject(form({ titleEn: 'Well' }), { needsProposal: true });
  assert.deepEqual(missing.problems, ['proposal_required', 'title_required', 'summary_required', 'cost_invalid']);
  const project = {
    proposalId: '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c', titleTa: 'சமூகக் கிணறு', titleEn: 'Community well',
    summaryTa: 'கைப்பம்பியுடன் மூடிய கிணறு ஒன்று.', summaryEn: 'A covered well with a hand pump.', estimatedCost: '600,000',
  };
  assert.deepEqual(readProject(form(project), { needsProposal: true }).input, { ...project, estimatedCost: '600000.00' });
  assert.equal('proposalId' in readProject(form(project), { needsProposal: false }).input, false);
});

test('reviews, moves, spending and completion are checked before the API sees them', () => {
  assert.deepEqual(readReview(form({ kind: 'audit', reference: 'x' })).problems, ['review_kind_required', 'review_reference_required', 'review_note_required']);
  assert.deepEqual(readReview(form({ kind: 'legal', reference: 'LG-12', noteTa: 'சட்ட ஆட்சேபனை இல்லை.', noteEn: 'No legal objection.' })).input.kind, 'legal');
  // Only the API's moves from each status; cancelling needs a reason.
  assert.deepEqual(readMove(form({ to: 'voting_closed' }), 'review').problems, ['move_required']);
  assert.deepEqual(readMove(form({ to: 'cancelled', reason: 'short' }), 'draft').problems, ['reason_required']);
  assert.deepEqual(readMove(form({ to: 'voting_open' }), 'review').input, { to: 'voting_open' });
  assert.deepEqual(MOVES.voting_closed, undefined, 'certification, allocation and completion move the cycle on by themselves');
  assert.deepEqual(readExpenditure(form({ amount: 'abc' })).problems, ['amount_invalid', 'spent_on_required', 'spending_description_required', 'evidence_ref_required']);
  assert.deepEqual(readCompletion(form({ completedOn: '2027-05-01', evidenceRef: 'CC-77' })).problems, ['completion_note_required']);
  // The town hall's words for legal_review_required belong to town halls; budgeting says its own.
  assert.deepEqual(ownProblems(['legal_review_required', 'financial_review_required']), ['pb_legal_review_required', 'financial_review_required']);
});

test('every budgeting refusal, problem and confirmation has Tamil and English words', () => {
  for (const code of ['budgeting_refused', 'already_certified_by_you']) {
    const words = bilingualMessageFor(code);
    assert.match(words.ta, TAMIL, code);
    assert.notEqual(words.en, code.replace(/_/g, ' '), code);
  }
  const problems = [
    'rules_locked', 'ballot_locked', 'closes_before_opens', 'voting_must_open_after_publication', 'rules_not_published_before_voting',
    'voting_window_passed', 'too_few_projects_on_ballot', 'max_choices_above_projects', 'voting_still_open', 'voting_overlaps_election_silence',
    'no_projects', 'proposal_not_approved_for_planning', 'already_in_cycle', 'financial_review_required', 'pb_legal_review_required',
    'voting_not_closed', 'chain_broken', 'chain_gap', 'ballot_altered', 'unknown_choice', 'count_mismatch', 'nothing_to_allocate',
    'allocations_exceed_budget', 'not_allocated', 'spending_exceeds_allocation', 'project_completed', 'area_level_invalid', 'unknown_area',
    'area_required', 'reason_required', 'proposal_required', ...Object.keys(BUDGET_TARGETS),
  ];
  for (const problem of problems) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, TAMIL, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of [
    'budget_cycle_created', 'budget_rules_saved', 'budget_moved_proposal_intake', 'budget_moved_review', 'budget_moved_voting_open',
    'budget_moved_voting_closed', 'budget_moved_cancelled', 'budget_project_added', 'budget_project_saved', 'budget_review_recorded',
    'budget_project_on_ballot', 'budget_project_off_ballot', 'budget_certified', 'budget_allocated', 'budget_spending_recorded',
    'budget_project_completed',
  ]) {
    assert.match(bilingualConfirmation(done).ta, TAMIL, done);
  }
});

test('the pages call the budgeting API and keep per-project totals out of sight until the count', async () => {
  const list = await readSrc('app/(staff)/budgeting/page.tsx');
  assert.match(list, /listManagedBudgetCycles\(\)/);
  assert.match(list, /NotSwitchedOn/);
  const detail = await readSrc('app/(staff)/budgeting/[id]/page.tsx');
  for (const call of ['getManagedBudgetCycle(', 'listBudgetCandidates(', 'recountBudgetCycle(']) assert.ok(detail.includes(call), call);
  for (const action of ['moveCycle', 'addProject', 'updateProject', 'recordReview', 'placeProject', 'certifyCycle', 'allocateCycle', 'recordExpenditure', 'recordCompletion']) {
    assert.ok(detail.includes(action), action);
  }
  // The recount runs only on request (each run is audited) and only after voting closes.
  assert.match(detail, /counted && one\(query\.recount\) === '1'/);
  assert.match(detail, /CONSULTATION_LABEL/);
  const actions = await readSrc('features/budgeting/actions.ts');
  for (const call of ['createBudgetCycle', 'updateBudgetCycle', 'moveBudgetCycle', 'addBudgetProject', 'updateBudgetProject', 'recordBudgetReview', 'placeBudgetProject', 'certifyBudgetCycle', 'allocateBudgetCycle', 'recordBudgetExpenditure', 'recordBudgetCompletion']) {
    assert.ok(actions.includes(`api.${call}(`), call);
  }
  assert.match(await readSrc('app/(staff)/budgeting/new/page.tsx'), /areaOptionsFor\(staff\.assignments, MANAGE\)/);
  assert.match(await readSrc('components/StaffSidebar.tsx'), /case '\/budgeting':/);
});
