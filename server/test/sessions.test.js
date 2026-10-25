// Tokens from the new API name a session; this API refuses them once that
// session is ended or idle (security review, 25 October 2026).
//
// A stand-in database records the queries, so these run without PostgreSQL.
// services/api/tests/test_express_compat.py runs the same check against a real
// database with sessions the new API created and ended.
//
//   npm test --prefix server
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionIsLive } from '../src/sessions.js';

const MEMBER = '7d4f6c1e-0d6a-4f8e-9a51-2a1f0c3b9e11';
const SESSION = '0b9e4a52-6f3d-4c1b-8e27-5d6a9f1c2e34';

function database(rows, { fail = false } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (fail) throw new Error('relation "identity.session" does not exist');
      return sql.startsWith('SELECT') ? { rowCount: rows.length, rows } : { rowCount: 1, rows: [] };
    },
  };
}

test('a token this API signed names no session and is not looked up', async () => {
  const db = database([]);
  assert.equal(await sessionIsLive(db, { sub: MEMBER, sv: 0 }), true);
  assert.equal(db.queries.length, 0);
});

test('a live session is accepted and its member is part of the lookup', async () => {
  const db = database([{ stale: false }]);
  assert.equal(await sessionIsLive(db, { sub: MEMBER, sv: 0, sid: SESSION }), true);
  assert.deepEqual(db.queries[0].params.slice(0, 2), [SESSION, MEMBER]);
  assert.match(db.queries[0].sql, /revoked_at IS NULL/);
  assert.equal(db.queries.length, 1);
});

test('an ended, idle or unknown session is refused', async () => {
  // The query finds no row for each of these; which one it was does not matter here.
  assert.equal(await sessionIsLive(database([]), { sub: MEMBER, sv: 0, sid: SESSION }), false);
});

test('a session not used for five minutes has its last use recorded', async () => {
  const db = database([{ stale: true }]);
  assert.equal(await sessionIsLive(db, { sub: MEMBER, sv: 0, sid: SESSION }), true);
  assert.match(db.queries[1].sql, /^UPDATE identity\.session SET last_seen_at/);
});

test('a database without the session registry refuses rather than accepts', async () => {
  assert.equal(await sessionIsLive(database([], { fail: true }), { sub: MEMBER, sv: 0, sid: SESSION }), false);
});
