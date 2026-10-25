// One membership state for every screen, and an official card only for a
// confirmed identity with an Active membership (QA audit, October 2026).
//
// A stand-in database answers the queries, so these run without PostgreSQL.
//
//   npm test --prefix server
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardIsOfficial, membershipStatus } from '../src/membership.js';

const MEMBER = '7d4f6c1e-0d6a-4f8e-9a51-2a1f0c3b9e11';

function database({ tablePresent, state }) {
  return {
    async query(sql) {
      if (sql.includes('to_regclass')) return { rows: [{ present: tablePresent }] };
      return { rows: state ? [{ state }] : [] };
    },
  };
}

test('without the new API\'s membership table every member is pending', async () => {
  assert.equal(await membershipStatus(MEMBER, database({ tablePresent: false })), 'pending');
});

test('the stored state is used, and no row means pending', async () => {
  assert.equal(await membershipStatus(MEMBER, database({ tablePresent: true, state: 'suspended' })), 'suspended');
  assert.equal(await membershipStatus(MEMBER, database({ tablePresent: true })), 'pending');
});

test('only a confirmed identity with an active membership has an official card', () => {
  assert.equal(cardIsOfficial('identity_confirmed', 'active'), true);
  assert.equal(cardIsOfficial('identity_confirmed', 'pending'), false);
  assert.equal(cardIsOfficial('nic_format', 'active'), false); // a well-formed number proves nothing
  assert.equal(cardIsOfficial('review_pending', 'active'), false);
});
