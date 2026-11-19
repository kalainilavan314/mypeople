import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  OFFICIAL_TARGETS,
  STATES,
  STATE_LABELS,
  readCorrection,
  readDraft,
  readPublisher,
  readWithdrawal,
  textProblems,
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

const STATEMENT = {
  titleTa: 'வெள்ள நிவாரணம்', titleEn: 'Flood relief',
  bodyTa: 'நிவாரணம் எப்போதும் இலவசம்.', bodyEn: 'Relief is always free.',
};
const IMAGE = '0b7c4c64-2a55-4f1f-9d1f-1a2b3c4d5e6f';
const NEW_IMAGE = '7d3e1f20-4b5a-4c6d-8e9f-0a1b2c3d4e5f';

test('official publishing is a built module for signers and Tier 5, and no longer planned', () => {
  const registered = builtModules.find((m) => m.href === '/publishing');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['content.sign_publish', 'system.configure']);
  assert.match(registered.ta, TAMIL);
  assert.equal(plannedModules.some((m) => /official publishing/i.test(m.name)), false);
  for (const state of STATES) assert.match(STATE_LABELS[state].ta, TAMIL, state);
});

test('a draft is saved as typed, even incomplete; signing needs both languages (FR-AUT-002)', () => {
  assert.deepEqual(readDraft(form({ titleEn: ' Only a title ' }), IMAGE), {
    titleTa: '', titleEn: 'Only a title', bodyTa: '', bodyEn: '', imageId: IMAGE,
  });
  assert.deepEqual(textProblems({ titleTa: '', titleEn: 'x', bodyTa: '', bodyEn: '' }), ['title_ta_required', 'body_ta_required', 'body_en_required']);
});

test('a correction needs the whole text and a reason in both languages, and says what happens to the image (BR-150)', () => {
  const missing = readCorrection(form({ ...STATEMENT, bodyEn: '', reasonTa: 'ok', image: 'keep' }), IMAGE);
  assert.equal(missing.input, null);
  assert.deepEqual(missing.problems, ['body_en_required', 'correction_reason_required']);

  const reasons = { reasonTa: 'எண் சேர்க்கப்பட்டது', reasonEn: 'Added the number' };
  assert.equal(readCorrection(form({ ...STATEMENT, ...reasons, image: 'keep' }), IMAGE).input.imageId, IMAGE);
  assert.equal(readCorrection(form({ ...STATEMENT, ...reasons, image: 'remove' }), IMAGE).input.imageId, null);
  assert.equal(readCorrection(form({ ...STATEMENT, ...reasons, image: 'new', newImageId: NEW_IMAGE }), IMAGE).input.imageId, NEW_IMAGE);
  assert.deepEqual(readCorrection(form({ ...STATEMENT, ...reasons, image: 'new' }), IMAGE).problems, ['image_not_found']);
  assert.equal(readCorrection(form({ ...STATEMENT, ...reasons, image: 'keep' }), null).input.imageId, null);
});

test('withdrawing and registering a publisher need their reasons and names in both languages', () => {
  assert.deepEqual(readWithdrawal(form({ reasonTa: 'மாற்றப்பட்டது', reasonEn: '' })).problems, ['withdrawal_reason_required']);
  assert.deepEqual(readWithdrawal(form({ reasonTa: 'மாற்றப்பட்டது', reasonEn: 'Replaced' })).input, { reasonTa: 'மாற்றப்பட்டது', reasonEn: 'Replaced' });
  assert.deepEqual(readPublisher(form({ memberCode: '', nameTa: 'ஊடகம்', nameEn: '' })).problems, ['member_not_found', 'publisher_name_required']);
  assert.deepEqual(readPublisher(form({ memberCode: ' NP-00012 ', nameTa: 'ஊடகப் பணிமனை', nameEn: 'Media office' })).input, {
    memberCode: 'NP-00012', nameTa: 'ஊடகப் பணிமனை', nameEn: 'Media office',
  });
});

test('every refusal and confirmation has words in both languages and a field to point at', () => {
  for (const problem of Object.keys(OFFICIAL_TARGETS)) {
    const words = bilingualProblemText(problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
    assert.match(words.ta, TAMIL, problem);
    assert.ok(targetOf(OFFICIAL_TARGETS, problem), problem);
  }
  for (const code of ['official_refused', 'signing_unavailable', 'not_a_registered_publisher', 'official_silence_period']) {
    assert.match(bilingualMessageFor(code).ta, TAMIL, code);
  }
  for (const done of ['official_drafted', 'official_saved', 'official_image_attached', 'official_image_removed', 'official_published',
    'official_corrected', 'official_withdrawn', 'publisher_registered', 'publisher_revoked']) {
    assert.match(bilingualConfirmation(done).ta, TAMIL, done);
  }
});

test('the pages say why signing is unavailable and send a silence refusal in the module’s words', async () => {
  const status = await readSrc('features/publishing/SigningStatus.tsx');
  assert.match(status, /no signing key is configured/);
  assert.match(status, /not a registered publisher/);
  const actions = await readSrc('features/publishing/actions.ts');
  assert.match(actions, /silence_period' \? 'official_silence_period'/);
  const sidebar = await readSrc('components/StaffSidebar.tsx');
  assert.match(sidebar, /case '\/publishing':/);
});
