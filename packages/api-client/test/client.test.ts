import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ApiError, createApiClient } from '../src/index.ts';

interface SentRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  credentials: string | undefined;
}

/** A fetch that records the request and answers with the given response. */
function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const sent: SentRequest[] = [];
  const fetch = async (url: string | URL | Request, init: RequestInit = {}) => {
    sent.push({
      url: String(url),
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body as string | undefined,
      credentials: init.credentials,
    });
    const payload = status === 204 ? null : JSON.stringify(body);
    return new Response(payload, { status, headers: { 'content-type': 'application/json', ...headers } });
  };
  return { fetch: fetch as typeof globalThis.fetch, sent };
}

const profile = {
  id: '3f1c2a9e-5b7d-4e8a-9c0f-1a2b3c4d5e6f',
  memberCode: 'WTL-26-1234567',
  fullName: 'Test Member',
  phone: null,
  dob: null,
  gender: null,
  language: 'ta',
  tier: 'volunteer',
  referralCode: 'TEST-1234',
  verificationStatus: 'unverified',
  verifiedAt: null,
  districtCode: null,
  districtName: null,
  dsCode: null,
  dsName: null,
  gsCode: null,
  gsName: null,
  joinedAt: '2026-10-24T12:00:00Z',
};

test('checkHealth calls /v1/health on the base URL', async () => {
  const { fetch, sent } = fakeFetch(200, { status: 'ok' });

  const health = await createApiClient({ baseUrl: 'https://api.example/', fetch }).checkHealth();

  assert.deepEqual(health, { status: 'ok' });
  assert.equal(sent[0].url, 'https://api.example/v1/health');
  assert.equal(sent[0].method, 'GET');
});

test('signIn posts the NIC and password as JSON', async () => {
  const { fetch, sent } = fakeFetch(200, { token: 'session-token', member: profile });

  const result = await createApiClient({ baseUrl: 'https://api.example', fetch }).signIn('199012345678', 'secret');

  assert.equal(result.token, 'session-token');
  assert.equal(result.member.fullName, 'Test Member');
  assert.equal(sent[0].url, 'https://api.example/v1/auth/sign-in');
  assert.equal(sent[0].method, 'POST');
  assert.equal(sent[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent[0].body ?? ''), { nic: '199012345678', password: 'secret' });
});

test('a mobile app session token is sent as a Bearer header', async () => {
  const { fetch, sent } = fakeFetch(200, profile);

  await createApiClient({ baseUrl: 'https://api.example', fetch, getToken: async () => 'stored-token' }).getMyProfile();

  assert.equal(sent[0].headers.Authorization, 'Bearer stored-token');
});

test('without a token, no Authorization header is sent and cookies are included', async () => {
  const { fetch, sent } = fakeFetch(200, profile);

  await createApiClient({ baseUrl: 'https://api.example', fetch, getToken: () => null }).getMyProfile();

  assert.equal(sent[0].headers.Authorization, undefined);
  assert.equal(sent[0].credentials, 'include');
});

test('wrong credentials become an ApiError with the API code', async () => {
  const { fetch } = fakeFetch(401, { detail: 'invalid_credentials' });

  await assert.rejects(createApiClient({ baseUrl: 'https://api.example', fetch }).signIn('1', 'wrong'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'invalid_credentials');
    assert.equal(error.retryAfter, null);
    return true;
  });
});

test('a sign-in lockout carries Retry-After', async () => {
  const { fetch } = fakeFetch(429, { detail: 'too_many_attempts' }, { 'retry-after': '900' });

  await assert.rejects(createApiClient({ baseUrl: 'https://api.example', fetch }).signIn('1', 'x'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'too_many_attempts');
    assert.equal(error.retryAfter, 900);
    return true;
  });
});

test('a validation error and a non-JSON error still give a usable code', async () => {
  const invalid = fakeFetch(422, { detail: [{ loc: ['body', 'nic'], msg: 'Field required', type: 'missing' }] });
  await assert.rejects(createApiClient({ baseUrl: 'https://api.example', fetch: invalid.fetch }).signIn('', ''), {
    code: 'invalid_request',
  });

  const proxyError = async () => new Response('<html>Bad gateway</html>', { status: 502 });
  await assert.rejects(
    createApiClient({ baseUrl: 'https://api.example', fetch: proxyError as typeof fetch }).checkHealth(),
    { status: 502, code: 'http_502' },
  );
});

test('signOut accepts the empty 204 response', async () => {
  const { fetch, sent } = fakeFetch(204, null);

  assert.equal(await createApiClient({ baseUrl: 'https://api.example', fetch }).signOut(), undefined);
  assert.equal(sent[0].url, 'https://api.example/v1/auth/sign-out');
});

test('a refused assignment carries the reasons', async () => {
  const { fetch } = fakeFetch(403, { detail: { code: 'assignment_refused', problems: ['tier_not_below_yours'] } });
  const input = {
    memberId: '3f1c2a9e-5b7d-4e8a-9c0f-1a2b3c4d5e6f',
    tier: '3A' as const,
    area: { level: 'district' as const, code: 'LK41' },
    permissions: ['cases.decide_district'],
  };

  await assert.rejects(createApiClient({ baseUrl: 'https://api.example', fetch }).createAssignment(input), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'assignment_refused');
    assert.deepEqual(error.problems, ['tier_not_below_yours']);
    return true;
  });
});

test('revoking posts the reason to the assignment', async () => {
  const { fetch, sent } = fakeFetch(200, {});

  await createApiClient({ baseUrl: 'https://api.example', fetch }).revokeAssignment('abc-123', 'Left the role');

  assert.equal(sent[0].url, 'https://api.example/v1/access/assignments/abc-123/revoke');
  assert.deepEqual(JSON.parse(sent[0].body ?? ''), { reason: 'Left the role' });
});

test('audit filters become query parameters', async () => {
  const { fetch, sent } = fakeFetch(200, []);
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.listAuditEntries({ action: 'access.denied', beforeId: 40, limit: 20 });
  await client.listAuditEntries();

  assert.equal(sent[0].url, 'https://api.example/v1/audit?action=access.denied&before_id=40&limit=20');
  assert.equal(sent[1].url, 'https://api.example/v1/audit');
});
