import test from 'node:test';
import assert from 'node:assert/strict';

import { builtModules, plannedModules } from './modules.ts';

test('households module registration and permission check (D02, PRM-33)', () => {
  const membersModule = builtModules.find((m) => m.href === '/members');
  assert.ok(membersModule, '/members module must be registered in builtModules');
  assert.equal(membersModule.permission, 'household.view_for_case');

  // Verify proper Tamil Unicode
  assert.match(membersModule.ta, /[\u0B80-\u0BFF]/);
  assert.equal(membersModule.en, 'Members and households');

  // Must not remain in plannedModules
  const inPlanned = plannedModules.some((m) => m.name.toLowerCase().includes('household') && m.name.toLowerCase().includes('members'));
  assert.equal(inPlanned, false, 'Members and households should be removed from plannedModules once built');
});

test('D02 household record: consent and area refusals in both languages, read-only, opened once', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const page = await read('app/(staff)/members/[memberId]/page.tsx');
  const action = await read('features/households/actions.ts');
  const view = await read('features/households/HouseholdDetailView.tsx');

  // Each refusal the API returns for D02 has its own Tamil and English words.
  for (const code of ['no_caseworker_consent', 'outside_your_area', 'forbidden', 'target_member_not_found']) {
    const entry = page.match(new RegExp(`${code}: \\{\\s*ta: '([^']+)',\\s*en: '([^']+)'`));
    assert.ok(entry, `${code} needs a bilingual message`);
    assert.match(entry[1], /[\u0B80-\u0BFF]/);
  }
  // The lookup only redirects: the record page asks the API once, so one opening is logged once.
  assert.doesNotMatch(action, /staffViewHousehold|staffApi/);
  // Read-only: no write calls, and the household's change log is not shown to staff.
  assert.doesNotMatch(view, /consentLogs|<form|action=/);
});
