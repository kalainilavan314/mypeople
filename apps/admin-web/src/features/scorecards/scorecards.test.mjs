import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { METRICS, lastFinishedQuarter, metricText, noteFor, quarterFinished, readCorrectionDecision, readFigures, readPeriod } from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('scorecards are a built module for scorecard publishing and every case permission', () => {
  const registered = builtModules.find((m) => m.href === '/scorecards');
  assert.ok(registered);
  for (const permission of ['scorecard.publish', 'cases.collect', 'cases.research', 'cases.decide_district', 'cases.plan_regional', 'cases.approve_executive', 'cases.implement_and_close']) {
    assert.ok(registered.permission.includes(permission), permission);
  }
  for (const metric of METRICS) assert.match(metric.label.ta, /[஀-௿]/, metric.key);
});

test('a quarter is written like 2026-Q4 and is finished only after its last day in Sri Lanka', () => {
  assert.deepEqual(readPeriod(form({ period: '2026-q3' })), { period: '2026-Q3', problems: [] });
  assert.deepEqual(readPeriod(form({ period: '2026-Q5' })).problems, ['period_invalid']);
  assert.equal(quarterFinished('2026-Q3', new Date('2026-09-30T18:29:00Z')), false);
  assert.equal(quarterFinished('2026-Q3', new Date('2026-09-30T18:30:00Z')), true);
  assert.equal(quarterFinished('2026-Q4', new Date('2026-11-13T00:00:00Z')), false);
  assert.equal(lastFinishedQuarter(new Date('2026-11-13T00:00:00Z')), '2026-Q3');
  assert.equal(lastFinishedQuarter(new Date('2027-02-01T00:00:00Z')), '2026-Q4');
});

test('figures show "Insufficient data" under 10 cases and every value with its numerator and denominator', () => {
  const areas = readFigures({
    'gn:G1': { insufficient: true },
    'district:LK41': {
      insufficient: false,
      metrics: {
        accepted: { value: 14, numerator: 14, denominator: null },
        closed_with_evidence: { value: 9, numerator: 9, denominator: 14 },
        resolution_rate: { value: 62.5, numerator: 5, denominator: 8 },
        average_processing_days: { value: 6.2, numerator: null, denominator: 9 },
      },
    },
  });
  assert.deepEqual(areas.map((area) => [area.areaKey, area.insufficient]), [['district:LK41', false], ['gn:G1', true]]);
  const byKey = Object.fromEntries(areas[0].metrics.map((metric) => [metric.key, metricText(metric)]));
  assert.equal(byKey.accepted, '14');
  assert.equal(byKey.closed_with_evidence, '9 (of 14 accepted)');
  assert.equal(byKey.resolution_rate, '62.5% (5 ÷ 8)');
  assert.equal(byKey.average_processing_days, '6.2 days (over 9 closed cases)');
  assert.equal(byKey.reopen_rate, '—');
  assert.deepEqual(noteFor({ 'gn:G1': { en: 'Floods in October', ta: 'ஒக்டோபர் வெள்ளம்' } }, 'gn:G1'), { en: 'Floods in October', ta: 'ஒக்டோபர் வெள்ளம்' });
});

test('a correction decision needs accept or reject and a note', () => {
  assert.deepEqual(readCorrectionDecision(form({ decision: 'accept' })).problems, ['decision_note_required']);
  assert.deepEqual(readCorrectionDecision(form({ note: 'Checked' })).problems, ['decision_required']);
  assert.deepEqual(readCorrectionDecision(form({ decision: 'reject', note: 'Figures match the case files.' })).input, { accept: false, note: 'Figures match the case files.' });
});

test('the scorecard page shows "Insufficient data", when it can be published, and names no person', async () => {
  const page = await readSrc('app/(staff)/scorecards/[id]/page.tsx');
  assert.match(page, /Insufficient data/);
  assert.match(page, /publishableAt/);
  assert.match(page, /10 working days/);
  assert.match(page, /loadAreaNames/);
  assert.doesNotMatch(page, /actorName|reporterName|fullName/);
});

test('scorecard refusals and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('scorecard_refused').ta, /[஀-௿]/);
  for (const problem of ['period_invalid', 'period_not_finished', 'draft_exists', 'review_period_running', 'unknown_metric', 'area_key_required', 'decision_note_required', 'note_text_required', 'already_decided']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of ['scorecard_drafted', 'scorecard_shared', 'scorecard_published', 'scorecard_note_saved', 'scorecard_correction_requested', 'scorecard_correction_accepted', 'scorecard_correction_rejected', 'scorecard_new_version']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
