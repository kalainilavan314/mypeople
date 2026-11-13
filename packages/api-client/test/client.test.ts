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

test('a refused assignment preview carries the reasons', async () => {
  const { fetch } = fakeFetch(403, { detail: { code: 'assignment_refused', problems: ['tier_not_below_yours'] } });
  const input = {
    memberId: '3f1c2a9e-5b7d-4e8a-9c0f-1a2b3c4d5e6f',
    tier: '3A' as const,
    area: { level: 'district' as const, code: 'LK41' },
    permissions: ['cases.decide_district'],
  };

  await assert.rejects(createApiClient({ baseUrl: 'https://api.example', fetch }).createAssignmentPreview(input), (error) => {
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

test('identity upload reports transmitted bytes and keeps the authenticated request', async () => {
  const document = { id: 'd2', kind: 'selfie', version: 1 };
  const progress: Array<[number, number]> = [];
  const headers: Record<string, string> = {};
  let sentBody: Document | Blob | ArrayBuffer | null = null;
  class FakeXhr {
    upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    timeout = 0;
    withCredentials = false;
    status = 201;
    responseText = JSON.stringify(document);
    open(method: string, url: string) {
      assert.equal(method, 'PUT');
      assert.equal(url, 'https://api.example/v1/identity/me/documents/selfie');
    }
    setRequestHeader(name: string, value: string) { headers[name] = value; }
    getResponseHeader(name: string) { return name === 'Content-Type' ? 'application/json' : null; }
    send(body: Document | Blob | ArrayBuffer | null) {
      sentBody = body;
      this.upload.onprogress?.({ loaded: 2 } as ProgressEvent);
      this.onload?.();
    }
  }
  const image = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
  const result = await createApiClient({
    baseUrl: 'https://api.example',
    getToken: () => 'member-token',
    xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
  }).uploadIdentityDocument('selfie', image, 'image/jpeg', (sent, total) => progress.push([sent, total]));

  assert.deepEqual(result, document);
  assert.equal(sentBody, image);
  assert.equal(headers.Authorization, 'Bearer member-token');
  assert.equal(headers['Content-Type'], 'image/jpeg');
  assert.deepEqual(progress, [[2, 4], [4, 4]]);
});

test('identity upload retries once with a renewed token after expiry', async () => {
  const attempts: string[] = [];
  let renewals = 0;
  const progress: Array<[number, number]> = [];
  const payloads = [
    { status: 401, body: { detail: 'token_expired' } },
    { status: 201, body: { id: 'd3', kind: 'nic_front' } },
  ];
  class FakeXhr {
    upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    timeout = 0;
    withCredentials = false;
    status = 0;
    responseText = '';
    open() { /* The path is covered by the normal upload test. */ }
    setRequestHeader(name: string, value: string) {
      if (name === 'Authorization') attempts.push(value);
    }
    getResponseHeader(name: string) { return name === 'Content-Type' ? 'application/json' : null; }
    send() {
      const response = payloads.shift();
      assert.ok(response);
      this.status = response.status;
      this.responseText = JSON.stringify(response.body);
      this.onload?.();
    }
  }
  const image = new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' });
  const client = createApiClient({
    baseUrl: 'https://api.example',
    getToken: () => 'expired-token',
    refresh: async () => { renewals += 1; return 'renewed-token'; },
    xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
  });
  const result = await client.uploadIdentityDocument('nic_front', image, 'image/jpeg', (sent, total) => progress.push([sent, total]));
  assert.deepEqual(result, { id: 'd3', kind: 'nic_front' });
  assert.deepEqual(attempts, ['Bearer expired-token', 'Bearer renewed-token']);
  assert.equal(renewals, 1);
  assert.deepEqual(progress, [[0, 2], [2, 2]]);
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

test('admin console list requests carry a scoped page offset', async () => {
  const { fetch, sent } = fakeFetch(200, []);
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.listManagedEvents({ states: ['draft'], limit: 26, offset: 25 });
  await client.listManagedAlbums({ states: ['submitted'], limit: 26, offset: 25 });
  await client.listRemovalRequests({ states: ['open'], limit: 26, offset: 25 });
  await client.listBroadcasts({ states: ['scheduled'], limit: 26, offset: 25 });
  await client.listIdentityReviews({ states: ['submitted'], limit: 26, offset: 25 });
  await client.listIdentityAppeals({ states: ['submitted'], limit: 26, offset: 25 });
  await client.listDuplicateCases({ states: ['open'], limit: 26, offset: 25 });

  assert.deepEqual(sent.map((request) => request.url.replace('https://api.example', '')), [
    '/v1/events/manage?state=draft&limit=26&offset=25',
    '/v1/content/albums/manage?state=submitted&limit=26&offset=25',
    '/v1/content/removal-requests?state=open&limit=26&offset=25',
    '/v1/notifications/broadcasts?state=scheduled&limit=26&offset=25',
    '/v1/identity/reviews?state=submitted&limit=26&offset=25',
    '/v1/identity/appeals?state=submitted&limit=26&offset=25',
    '/v1/identity/duplicates?state=open&limit=26&offset=25',
  ]);
});

test('broadcast audience estimate defaults to all active members in the selected area', async () => {
  const { fetch, sent } = fakeFetch(200, { reaches: 42 });
  const result = await createApiClient({ baseUrl: 'https://api.example', fetch })
    .estimateBroadcastReach({ level: 'district', code: 'LK11' });

  assert.deepEqual(result, { reaches: 42 });
  assert.equal(sent[0].url, 'https://api.example/v1/notifications/broadcasts/reach');
  assert.deepEqual(JSON.parse(sent[0].body ?? ''), {
    area: { level: 'district', code: 'LK11' },
    audienceTiers: null,
  });
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

test('replacing a recovery number sends the current password with its six-digit code', async () => {
  const { fetch, sent } = fakeFetch(200, { phone: '+94771234567' });
  await createApiClient({ baseUrl: 'https://api.example', fetch }).confirmPhone('0771234567', '123456', 'current secret');

  assert.equal(sent[0].url, 'https://api.example/v1/identity/me/phone/confirm');
  assert.deepEqual(JSON.parse(sent[0].body ?? ''), {
    phone: '0771234567', code: '123456', currentPassword: 'current secret',
  });
});

test('authenticator enrolment sends the current password', async () => {
  const { fetch, sent } = fakeFetch(200, { secret: 'ABC', otpauthUri: 'otpauth://totp/example' });
  await createApiClient({ baseUrl: 'https://api.example', fetch }).startTotpEnrolment('current secret');

  assert.equal(sent[0].url, 'https://api.example/v1/auth/mfa/totp');
  assert.deepEqual(JSON.parse(sent[0].body ?? ''), { currentPassword: 'current secret' });
});

test('recovery verification sends the account number with the code', async () => {
  const { fetch, sent } = fakeFetch(200, { resetToken: 'r', expiresInSeconds: 600 });

  const token = await createApiClient({ baseUrl: 'https://api.example', fetch }).verifyRecovery({ nic: '123456789V' }, '123456');

  assert.equal(token.resetToken, 'r');
  assert.equal(sent[0].body, JSON.stringify({ nic: '123456789V', code: '123456' }));
});

test('an app install id is sent with every request', async () => {
  const { fetch, sent } = fakeFetch(200, []);

  await createApiClient({ baseUrl: 'https://api.example', fetch, deviceId: 'install-123' }).listMySessions();

  assert.equal(sent[0].headers['X-Device-Id'], 'install-123');
  assert.equal(sent[0].url, 'https://api.example/v1/auth/sessions');
});

test('a scan posts the code and returns the result', async () => {
  const { fetch, sent } = fakeFetch(200, { result: 'expired', displayName: null, memberCode: null });

  const result = await createApiClient({ baseUrl: 'https://api.example', fetch }).scanMemberCard('C1.a.b.c.d.e');

  assert.equal(result.result, 'expired');
  assert.equal(sent[0].url, 'https://api.example/v1/membership/card/scan');
});

test('events are listed with their filters and a response is put to the RSVP', async () => {
  const { fetch, sent } = fakeFetch(200, []);
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.listEvents({ scope: 'all', participation: 'going', q: 'hall' });
  await client.respondToEvent('e 1', 'maybe');

  assert.equal(sent[0].url, 'https://api.example/v1/events?scope=all&participation=going&q=hall');
  assert.equal(sent[1].url, 'https://api.example/v1/events/e%201/rsvp');
  assert.equal(sent[1].method, 'PUT');
  assert.deepEqual(JSON.parse(sent[1].body ?? ''), { response: 'maybe' });
});

test('a gallery photo is uploaded as its own bytes and shown from a URL on the API', async () => {
  const { fetch, sent } = fakeFetch(201, { id: 'p1' });
  const client = createApiClient({ baseUrl: 'https://api.example/', fetch });
  const image = new Uint8Array([0xff, 0xd8, 0xff]).buffer;

  await client.uploadAlbumPhoto('a 1', image, 'image/jpeg');

  assert.equal(sent[0].url, 'https://api.example/v1/content/albums/a%201/photos');
  assert.equal(sent[0].headers['Content-Type'], 'image/jpeg');
  assert.equal(sent[0].body, image);
  assert.equal(client.galleryPhotoUrl('p1', 'thumb'), 'https://api.example/v1/content/photos/p1/thumb');
});


test('a manual check-in sends the member ID and the reason', async () => {
  const { fetch, sent } = fakeFetch(200, { result: 'checked_in', fullName: 'A', memberCode: 'WTL-26-1234567' });

  const result = await createApiClient({ baseUrl: 'https://api.example', fetch }).checkInManually('e 1', 'WTL-26-1234567', 'No phone');

  assert.equal(result.result, 'checked_in');
  assert.equal(sent[0].url, 'https://api.example/v1/events/e%201/checkin/manual');
  assert.deepEqual(JSON.parse(sent[0].body ?? ''), { memberCode: 'WTL-26-1234567', reason: 'No phone' });
});

test('enabled features are read without sign-in and election periods are listed by state', async () => {
  const { fetch, sent } = fakeFetch(200, { enabled: [] });
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.getEnabledFeatures();
  await client.listElectionPeriods({ states: ['declared', 'ended'] });

  assert.equal(sent[0].url, 'https://api.example/v1/features');
  assert.equal(sent[1].url, 'https://api.example/v1/election/periods?state=declared&state=ended');
});

test('a server calling for a staff member forwards their address, and lookups send the exact ID', async () => {
  const { fetch, sent } = fakeFetch(200, { memberId: 'm1' });

  await createApiClient({ baseUrl: 'https://api.example', fetch, forwardedFor: '203.0.113.7' }).lookupMember('WTL-26 1');

  assert.equal(sent[0].headers['X-Forwarded-For'], '203.0.113.7');
  assert.equal(sent[0].url, 'https://api.example/v1/membership/lookup?code=WTL-26%201');
});

test('an expired token is renewed once and the request sent again', async () => {
  const sent: string[] = [];
  const fetch = (async (_url: string | URL | Request, init: RequestInit = {}) => {
    const authorization = (init.headers as Record<string, string>).Authorization;
    sent.push(authorization);
    return authorization === 'Bearer old'
      ? new Response(JSON.stringify({ detail: 'token_expired' }), { status: 401 })
      : new Response(JSON.stringify(profile), { status: 200 });
  }) as typeof globalThis.fetch;
  let renewals = 0;
  const refresh = async () => {
    renewals += 1;
    return 'new';
  };

  const me = await createApiClient({ baseUrl: 'https://api.example', fetch, getToken: () => 'old', refresh }).getMyProfile();

  assert.deepEqual(me, profile);
  assert.deepEqual(sent, ['Bearer old', 'Bearer new']);
  assert.equal(renewals, 1);
});

test('other refusals, and a renewal the server refused, are not sent again', async () => {
  const refused = fakeFetch(401, { detail: 'session_expired' });
  let renewals = 0;
  const refresh = async () => {
    renewals += 1;
    return null;
  };

  await assert.rejects(
    createApiClient({ baseUrl: 'https://api.example', fetch: refused.fetch, getToken: () => 'old', refresh }).getMyProfile(),
    (error: unknown) => error instanceof ApiError && error.code === 'session_expired',
  );
  const expired = fakeFetch(401, { detail: 'token_expired' });
  await assert.rejects(
    createApiClient({ baseUrl: 'https://api.example', fetch: expired.fetch, getToken: () => 'old', refresh }).getMyProfile(),
    (error: unknown) => error instanceof ApiError && error.code === 'token_expired',
  );

  assert.equal(refused.sent.length + expired.sent.length, 2);
  assert.equal(renewals, 1);
});

test('refresh tokens, security alerts and access reviews go to their endpoints', async () => {
  const { fetch, sent } = fakeFetch(200, {});
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.refreshSession('session.secret');
  await client.refreshSession();
  await client.answerSecurityAlert('a1', 'not_me');
  await client.listDueAccessReviews();
  await client.reviewAssignment('g1', 'revoked', 'Left the district office');

  assert.deepEqual(
    sent.map((request) => [request.method, request.url.replace('https://api.example', ''), request.body]),
    [
      ['POST', '/v1/auth/refresh', '{"refreshToken":"session.secret"}'],
      ['POST', '/v1/auth/refresh', '{"refreshToken":null}'],
      ['POST', '/v1/auth/security-alerts/a1/answer', '{"answer":"not_me"}'],
      ['GET', '/v1/access/reviews', undefined],
      ['POST', '/v1/access/reviews/g1', '{"decision":"revoked","reason":"Left the district office"}'],
    ],
  );
});

test('household endpoints call their routes with correct payload', async () => {
  const { fetch, sent } = fakeFetch(200, {});
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.getMyHousehold();
  await client.createHousehold({ name: 'Our Home' });
  await client.updateHousehold({ name: 'Renamed Home' });
  await client.getMyInvitations();
  await client.inviteAdult({ memberCode: 'NPM-1234', relationship: 'spouse' });
  await client.respondInvitation('inv-1', { action: 'accept' });
  await client.revokeInvitation('inv-1');
  await client.removeHouseholdMember('rec-1');
  await client.updateMyHouseholdDetails({ ageBand: '35_44', occupationCategory: null });
  await client.correctHouseholdRelationship('rec-2', { relationship: 'parent' });
  await client.addHouseholdDependant({ firstName: 'Nila', relationship: 'child', birthYear: 2020 });
  await client.updateHouseholdDependant('rec-3', { birthYear: 2019 });
  await client.removeHouseholdDependant('rec-3');
  await client.getHouseholdLog();
  await client.giveCaseworkerConsent();
  await client.withdrawCaseworkerConsent();
  await client.leaveHousehold();
  await client.getHouseholdPrivacyNotice();
  await client.staffViewHousehold('target-1');

  assert.deepEqual(
    sent.map((request) => [request.method, request.url.replace('https://api.example', ''), request.body]),
    [
      ['GET', '/v1/households/mine', undefined],
      ['POST', '/v1/households', '{"name":"Our Home"}'],
      ['PATCH', '/v1/households/mine', '{"name":"Renamed Home"}'],
      ['GET', '/v1/households/invitations/mine', undefined],
      ['POST', '/v1/households/invitations', '{"memberCode":"NPM-1234","relationship":"spouse"}'],
      ['POST', '/v1/households/invitations/inv-1/respond', '{"action":"accept"}'],
      ['POST', '/v1/households/invitations/inv-1/revoke', undefined],
      ['POST', '/v1/households/members/rec-1/remove', undefined],
      ['PATCH', '/v1/households/members/me', '{"ageBand":"35_44","occupationCategory":null}'],
      ['PATCH', '/v1/households/members/rec-2', '{"relationship":"parent"}'],
      ['POST', '/v1/households/dependants', '{"firstName":"Nila","relationship":"child","birthYear":2020}'],
      ['PATCH', '/v1/households/dependants/rec-3', '{"birthYear":2019}'],
      ['DELETE', '/v1/households/dependants/rec-3', undefined],
      ['GET', '/v1/households/mine/log', undefined],
      ['POST', '/v1/households/mine/caseworker-consent', undefined],
      ['DELETE', '/v1/households/mine/caseworker-consent', undefined],
      ['POST', '/v1/households/leave', undefined],
      ['GET', '/v1/households/privacy', undefined],
      ['GET', '/v1/households/staff/target-1', undefined],
    ],
  );
});

test('community report endpoints call their routes with correct parameters', async () => {
  const { fetch, sent } = fakeFetch(200, {});
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.getCommunityReportCounts();
  await client.listCommunityReports({ status: 'submitted', limit: 25, offset: 50 });
  await client.getCommunityReport('report 1');

  assert.deepEqual(
    sent.map((request) => [request.method, request.url.replace('https://api.example', ''), request.body]),
    [
      ['GET', '/v1/community/reports/counts', undefined],
      ['GET', '/v1/community/reports?status=submitted&limit=25&offset=50', undefined],
      ['GET', '/v1/community/reports/report%201', undefined],
    ],
  );
});

test('broadcast reach sends an optional effective staff tier filter', async () => {
  const { fetch, sent } = fakeFetch(200, { reaches: 1 });
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.estimateBroadcastReach({ level: 'district', code: 'LK-11' });
  await client.estimateBroadcastReach({ level: 'district', code: 'LK-11' }, ['2A']);

  assert.deepEqual(sent.map((request) => JSON.parse(request.body ?? '{}')), [
    { area: { level: 'district', code: 'LK-11' }, audienceTiers: null },
    { area: { level: 'district', code: 'LK-11' }, audienceTiers: ['2A'] },
  ]);
});

test('community finance fund and staff endpoints call their routes with correct parameters', async () => {
  const { fetch, sent } = fakeFetch(200, {});
  const client = createApiClient({ baseUrl: 'https://api.example', fetch });

  await client.getFundConfig();
  await client.createContribution(
    {
      amountMinor: 250000,
      transferDate: '2026-11-09',
      bankReference: 'TXN123456789',
      noPrivilegeAcknowledged: true,
      informationAccurateAcknowledged: true,
      payingForSelf: true,
    },
    'idem-key-1',
  );
  await client.uploadContributionSlip('c-1', new Uint8Array([1, 2, 3]), 'image/jpeg');
  await client.submitContribution('c-1');
  await client.getMyContributions(10, 0);
  await client.getMyContribution('c-1');
  await client.getMyContributionReceipt('c-1');

  await client.listFinanceContributions({ status: 'SUBMITTED', month: '2026-11', riskFlag: 'duplicate_bank_reference', limit: 50 });
  await client.getFinanceContribution('c-1');
  await client.claimFinanceContribution('c-1');
  await client.getFinanceSlipViewToken('c-1');
  await client.reconcileFinanceContribution('c-1', {
    action: 'matched',
    statementReference: 'STMT-99',
    reason: 'Matched with bank statement',
  });
  await client.approveFinanceContribution('c-1', {
    action: 'approve',
    reason: 'Second person verified',
    relatedPartyConflict: false,
  });

  assert.deepEqual(
    sent.map((request) => [request.method, request.url.replace('https://api.example', ''), request.body]),
    [
      ['GET', '/v1/fund/config', undefined],
      [
        'POST',
        '/v1/fund/contributions',
        '{"currency":"LKR","declarationVersion":"v1","amountMinor":250000,"transferDate":"2026-11-09","bankReference":"TXN123456789","noPrivilegeAcknowledged":true,"informationAccurateAcknowledged":true,"payingForSelf":true}',
      ],
      ['PUT', '/v1/fund/contributions/c-1/slip', new Uint8Array([1, 2, 3])],
      ['POST', '/v1/fund/contributions/c-1/submit', undefined],
      ['GET', '/v1/fund/contributions/mine?limit=10&offset=0', undefined],
      ['GET', '/v1/fund/contributions/c-1', undefined],
      ['GET', '/v1/fund/contributions/c-1/receipt', undefined],
      ['GET', '/v1/finance/contributions?status=SUBMITTED&month=2026-11&risk_flag=duplicate_bank_reference&limit=50', undefined],
      ['GET', '/v1/finance/contributions/c-1', undefined],
      ['POST', '/v1/finance/contributions/c-1/claim', undefined],
      ['POST', '/v1/finance/contributions/c-1/slip-view', undefined],
      [
        'POST',
        '/v1/finance/contributions/c-1/reconcile',
        '{"action":"matched","statementReference":"STMT-99","reason":"Matched with bank statement"}',
      ],
      [
        'POST',
        '/v1/finance/contributions/c-1/approve',
        '{"action":"approve","reason":"Second person verified","relatedPartyConflict":false}',
      ],
    ],
  );
  assert.equal(sent[1].headers['Idempotency-Key'], 'idem-key-1');
});
