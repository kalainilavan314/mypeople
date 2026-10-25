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

test('an identity image is sent as it is, with its own media type', async () => {
  const document = { id: 'd1', kind: 'nic_front', version: 1, contentType: 'image/jpeg', byteSize: 3, serverAckAt: '2026-10-25T00:00:00Z' };
  const { fetch, sent } = fakeFetch(201, document);
  const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });

  const acknowledged = await createApiClient({ baseUrl: 'https://api.example', fetch }).uploadIdentityDocument(
    'nic_front',
    image,
    'image/jpeg',
  );

  assert.deepEqual(acknowledged, document);
  assert.equal(sent[0].url, 'https://api.example/v1/identity/me/documents/nic_front');
  assert.equal(sent[0].method, 'PUT');
  assert.equal(sent[0].headers['Content-Type'], 'image/jpeg');
  assert.equal(sent[0].body as unknown, image);
});

test('openEvidence returns an absolute link on the API', async () => {
  const { fetch, sent } = fakeFetch(200, { url: '/v1/identity/evidence/abc.def.ghi', expiresAt: '2026-10-25T00:05:00Z' });

  const link = await createApiClient({ baseUrl: 'https://api.example/', fetch }).openEvidence('d1');

  assert.equal(sent[0].url, 'https://api.example/v1/identity/documents/d1/view-link');
  assert.equal(sent[0].method, 'POST');
  assert.deepEqual(link, { url: 'https://api.example/v1/identity/evidence/abc.def.ghi', expiresAt: '2026-10-25T00:05:00Z' });
});

test('review filters repeat each state and keep the reference', async () => {
  const { fetch, sent } = fakeFetch(200, []);
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.listIdentityReviews({ states: ['submitted', 'needs_update'], mine: true, ref: 'VR-00421' });
  await client.listIdentityReviews();

  assert.equal(sent[0].url, 'https://api.example/v1/identity/reviews?state=submitted&state=needs_update&mine=true&ref=VR-00421');
  assert.equal(sent[1].url, 'https://api.example/v1/identity/reviews');
});

test('a refused submission carries the missing items', async () => {
  const { fetch, sent } = fakeFetch(409, { detail: { code: 'submission_refused', problems: ['missing:selfie'] } });

  const error = await createApiClient({ baseUrl: 'https://api.example', fetch })
    .submitIdentityReview('nic', true)
    .catch((e: unknown) => e);

  assert.ok(error instanceof ApiError);
  assert.deepEqual([error.status, error.code, error.problems], [409, 'submission_refused', ['missing:selfie']]);
  assert.equal(sent[0].body, JSON.stringify({ route: 'nic', declaration: true }));
});

test('an appeal sends the statement and a used appeal carries its reason', async () => {
  const { fetch, sent } = fakeFetch(409, { detail: { code: 'appeal_refused', problems: ['appeal_used'] } });

  const error = await createApiClient({ baseUrl: 'https://api.example', fetch })
    .appealMyIdentityDecision('The card is mine.')
    .catch((e: unknown) => e);

  assert.equal(sent[0].url, 'https://api.example/v1/identity/me/review/appeal');
  assert.equal(sent[0].body, JSON.stringify({ statement: 'The card is mine.' }));
  assert.ok(error instanceof ApiError);
  assert.deepEqual([error.code, error.problems], ['appeal_refused', ['appeal_used']]);
});

test('a membership change posts the action and reason to the member', async () => {
  const { fetch, sent } = fakeFetch(200, { memberId: 'm1', state: 'suspended', history: [] });

  await createApiClient({ baseUrl: 'https://api.example', fetch }).changeMembership('m1', {
    action: 'suspend',
    reasonCode: 'conduct_investigation',
  });

  assert.equal(sent[0].url, 'https://api.example/v1/membership/members/m1/changes');
  assert.equal(sent[0].body, JSON.stringify({ action: 'suspend', reasonCode: 'conduct_investigation' }));
});

test('duplicate cases are listed with the same state filters as appeals', async () => {
  const { fetch, sent } = fakeFetch(200, []);

  await createApiClient({ baseUrl: 'https://api.example', fetch }).listDuplicateCases({ states: ['open'], mine: true });

  assert.equal(sent[0].url, 'https://api.example/v1/identity/duplicates?state=open&mine=true');
});

test('passport sign-in sends the number and country, not a NIC', async () => {
  const { fetch, sent } = fakeFetch(200, { token: 't', member: profile });

  await createApiClient({ baseUrl: 'https://api.example', fetch }).signInWithPassport('N1234567', 'LKA', 'a long passphrase');

  assert.equal(sent[0].body, JSON.stringify({ passportNumber: 'N1234567', passportCountry: 'LKA', password: 'a long passphrase' }));
});

test('consent accepts the empty 204 response', async () => {
  const { fetch, sent } = fakeFetch(204, null);

  await createApiClient({ baseUrl: 'https://api.example', fetch }).giveIdentityConsent('draft-2026-10');

  assert.equal(sent[0].url, 'https://api.example/v1/identity/me/consent');
});
