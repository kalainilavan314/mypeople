import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Isolated fake database and unique temporary objects; no real member writes.
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.DATABASE_URL = 'postgres://fixture:fixture@127.0.0.1:1/fixture';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_KEY = '';
process.env.JWT_SECRET = 'avatar-regression-fixture-only';
const { replaceAvatar } = await import('../server/src/avatar.js');
const { pool } = await import('../server/src/db.js');
const { putObject, getObject, deleteObject } = await import('../server/src/storage.js');
const { signToken } = await import('../server/src/lib.js');
const pg = createRequire(new URL('../server/package.json', import.meta.url))('pg');
pg.Client.prototype.connect = async () => {};
pg.Client.prototype.query = async () => ({ rows: [] });
pg.Client.prototype.end = async () => {};

function database() {
  const member = { id: '90000000-0000-4000-8000-000000000001', full_name: 'Upload fixture',
    member_code: 'FIXTURE-ONLY', avatar_path: null, recruit_count: 0, gs_code: null,
    tier: 'volunteer', language: 'en', created_at: new Date(), session_version: 0 };
  let waiting = Promise.resolve();
  const state = { member, failUpdate: false, failCommit: false };
  state.connect = async () => {
    let unlock, release, previous, pending;
    return {
      async query(sql, values) {
        if (sql === 'BEGIN') return { rows: [] };
        if (sql.includes('FOR UPDATE')) {
          const prior = waiting;
          waiting = new Promise(resolve => { unlock = resolve; });
          await prior;
          release = unlock;
          previous = member.avatar_path;
          return { rows: values[0] === member.id ? [{ avatar_path: previous }] : [] };
        }
        if (sql.startsWith('UPDATE npm.member SET avatar_path')) {
          assert.equal(values[1], member.id, 'upload must use the authenticated member');
          if (state.failUpdate) throw new Error('fixture database failure');
          pending = values[0];
          return { rows: [] };
        }
        if (sql === 'COMMIT') member.avatar_path = pending;
        else if (sql !== 'ROLLBACK') throw new Error(`Unexpected transaction query: ${sql}`);
        release?.();
        release = null;
        if (sql === 'COMMIT' && state.failCommit) throw new Error('fixture commit acknowledgement failure');
        return { rows: [] };
      },
      release() { release?.(); },
    };
  };
  return state;
}

const state = database(), objects = new Map([['old.jpg', Buffer.from('old')]]);
state.member.avatar_path = 'old.jpg';
const services = {
  pool: state,
  putObject: async (_area, filename, bytes) => { objects.set(filename, bytes); },
  deleteObject: async (_area, filename) => { objects.delete(filename); },
};
const image = { ext: 'png', buf: fs.readFileSync(new URL('../app/public/favicon.png', import.meta.url)) };
state.failUpdate = true;
await assert.rejects(replaceAvatar(state.member.id, image, services), /fixture database failure/);
assert.equal(state.member.avatar_path, 'old.jpg');
assert.deepEqual([...objects.keys()], ['old.jpg'], 'failed database write preserves old image and removes new upload');
state.failUpdate = false;
await assert.rejects(replaceAvatar(state.member.id, image, { ...services,
  putObject: async (_area, filename, bytes) => { objects.set(filename, bytes); throw new Error('fixture storage failure'); },
}), /fixture storage failure/);
assert.deepEqual([...objects.keys()], ['old.jpg']);
await assert.rejects(replaceAvatar('unknown', image, services), /unauthorized/);
assert.deepEqual([...objects.keys()], ['old.jpg']);
const replacements = await Promise.all([
  replaceAvatar(state.member.id, image, services), replaceAvatar(state.member.id, image, services),
]);
assert.equal(state.member.avatar_path, replacements[1]);
assert.deepEqual([...objects.keys()], [replacements[1]], 'concurrent replacements leave one current object');
state.failCommit = true;
await assert.rejects(replaceAvatar(state.member.id, image, services), /fixture commit acknowledgement failure/);
assert(objects.has(state.member.avatar_path), 'uncertain commit must not delete a possibly committed image');
state.failCommit = false;

const routeDb = database();
pool.connect = routeDb.connect;
pool.query = async (sql, values) => {
  if (sql.includes('FROM npm.member m') && sql.includes('m.id = $1')) {
    return { rows: values[0] === routeDb.member.id ? [{ ...routeDb.member }] : [] };
  }
  if (sql.startsWith('SELECT avatar_path')) return { rows: [{ avatar_path: routeDb.member.avatar_path }] };
  if (sql.includes('SELECT id FROM npm.member WHERE phone')) return { rows: [] };
  if (sql.startsWith('UPDATE npm.member SET phone=')) {
    routeDb.member.phone = values[0];
    return { rows: [] };
  }
  throw new Error(`Unexpected fixture query: ${sql}`);
};
const { default: app } = await import('../server/src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const headers = { 'content-type': 'application/json', cookie: `mp_session=${signToken(routeDb.member.id)}` };
const payload = { image: `data:image/png;base64,${image.buf.toString('base64')}` };
let original, first;
const expectedErrors = [], reportError = console.error;
console.error = error => { expectedErrors.push(error.message); };
try {
  assert.equal((await fetch(base + '/api/me/avatar', { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } })).status, 401);
  assert.equal((await fetch(base + '/api/me/avatar', { method: 'POST', body: JSON.stringify(payload), headers: { ...headers, origin: 'https://untrusted.invalid' } })).status, 403, 'cookie upload retains same-origin CSRF protection');
  assert.equal((await fetch(base + '/api/me/avatar', { method: 'POST', body: JSON.stringify({ image: 'invalid' }), headers })).status, 400);
  original = `fixture-${crypto.randomUUID()}.jpg`;
  await putObject('avatars', original, image.buf);
  routeDb.member.avatar_path = original;
  const uploaded = await fetch(base + '/api/me/avatar', { method: 'POST', body: JSON.stringify(payload), headers });
  assert.equal(uploaded.status, 200, 'actual upload route returns success');
  const { member } = await uploaded.json();
  assert.equal(member.id, routeDb.member.id);
  first = routeDb.member.avatar_path;
  assert.notEqual(first, original);
  assert.equal(await getObject('avatars', original), null);
  assert.deepEqual(await getObject('avatars', first), image.buf);
  const loaded = await fetch(base + member.avatarUrl);
  assert.equal(loaded.status, 200, 'new signed avatar can be loaded');
  assert.match(loaded.headers.get('content-type'), /^image\/png/);
  assert.equal((await fetch(base + `/api/avatars/${member.id}`)).status, 404, 'unsigned avatar remains private');
  routeDb.failUpdate = true;
  assert.equal((await fetch(base + '/api/me/avatar', { method: 'POST', body: JSON.stringify(payload), headers })).status, 500);
  assert.equal(routeDb.member.avatar_path, first);
  assert.deepEqual(await getObject('avatars', first), image.buf);
  assert.equal((await fetch(base + member.avatarUrl)).status, 200, 'prior signed image still works after a failed replacement');
  const nullPhone = await fetch(base + '/api/me', { method: 'PATCH', headers, body: JSON.stringify({ phone: null }) });
  assert.equal(nullPhone.status, 200);
  assert.equal(routeDb.member.phone, null, 'empty optional phone is SQL null, never the string "null"');
} finally {
  console.error = reportError;
  for (const name of [original, first, routeDb.member.avatar_path]) if (name) await deleteObject('avatars', name);
  await new Promise(resolve => server.close(resolve));
  await pool.end();
}
assert.deepEqual(expectedErrors, ['unauthorized', 'bad_image', 'not_found', 'fixture database failure']);
console.log('Passed avatar upload route, cookie authentication, CSRF protection, signed access, failed replacement cleanup, storage failure, concurrent replacement, uncertain commit and null phone regression checks.');
