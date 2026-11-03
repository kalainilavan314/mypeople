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
