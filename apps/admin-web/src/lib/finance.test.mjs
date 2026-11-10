import test from 'node:test';
import assert from 'node:assert/strict';

import { builtModules, plannedModules } from './modules.ts';

test('finance module registration and permission check (D10, M1.4)', () => {
  const financeModule = builtModules.find((m) => m.href === '/finance');
  assert.ok(financeModule, '/finance module must be registered in builtModules');
  assert.deepEqual(financeModule.permission, [
    'finance.review',
    'finance.approve',
    'finance.export',
    'finance.audit_read',
  ]);

  // Verify proper Tamil Unicode
  assert.match(financeModule.ta, /[\u0B80-\u0BFF]/);
  assert.equal(financeModule.en, 'Finance queue & slips');

  // Must not remain in plannedModules
  const inPlanned = plannedModules.some((m) => m.name.toLowerCase().includes('finance'));
  assert.equal(inPlanned, false, 'Finance and reconciliation should be removed from plannedModules once built');
});
