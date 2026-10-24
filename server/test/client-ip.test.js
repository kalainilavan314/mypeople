// Which address the sign-in and OTP limits count against.
//
// Runs a small Express app with the same 'trust proxy' setting as src/index.js
// and the real clientIp(). Requests come from 127.0.0.1, the way Nginx on the
// same machine connects, so X-Forwarded-For is read as it is in production.
//
//   npm test --prefix server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { clientIp, TRUSTED_PROXIES } from '../src/throttle.js';
import { pool } from '../src/db.js';

const app = express();
app.set('trust proxy', TRUSTED_PROXIES);
app.get('/ip', (req, res) => res.send(clientIp(req)));

let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end(); // throttle.js opens a pool on import; nothing here uses it
});

async function addressSeen(forwardedFor) {
  const headers = forwardedFor ? { 'x-forwarded-for': forwardedFor } : {};
  return (await fetch(`${base}/ip`, { headers })).text();
}

test('without a proxy header, the connection address counts', async () => {
  assert.equal(await addressSeen(null), '127.0.0.1');
});

test('the address Nginx sets with $remote_addr counts', async () => {
  assert.equal(await addressSeen('203.0.113.9'), '203.0.113.9');
});

test('an address the client forged in front of the real one is ignored', async () => {
  // What Nginx sends with $proxy_add_x_forwarded_for when a client supplies its
  // own header: the forged value first, the real address appended last. This
  // is the case that used to return the forged address.
  assert.equal(await addressSeen('198.51.100.66, 203.0.113.9'), '203.0.113.9');
});

test('several forged addresses are ignored too', async () => {
  assert.equal(await addressSeen('10.0.0.1, 198.51.100.66, 203.0.113.9'), '203.0.113.9');
});

test('a client claiming to be the proxy itself is ignored', async () => {
  // A forged 127.0.0.1 in front would otherwise be skipped as "trusted" and
  // could shift the count onto a shared address.
  assert.equal(await addressSeen('127.0.0.1, 203.0.113.9'), '203.0.113.9');
});
