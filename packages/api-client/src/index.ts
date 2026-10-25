// Typed functions for the My People API (/v1), used by the Expo apps and the
// Next.js dashboard.
//
// The types come from the API's OpenAPI document. src/schema.ts is generated
// (npm run generate) and must not be edited by hand; after an API change,
// re-export openapi.json and regenerate it, and CI checks that you did.
import type { components, operations } from './schema';

type Schemas = components['schemas'];
export type HealthStatus = Schemas['HealthStatus'];
export type MemberProfile = Schemas['MemberProfile'];
export type SignInResponse = Schemas['SignInResponse'];
export type AreaRef = Schemas['AreaRef'];
export type AssignmentInput = Schemas['AssignmentInput'];
export type Assignment = Schemas['AssignmentOut'];
export type AssignmentPreview = Schemas['PreviewOut'];
export type AccessCatalogue = Schemas['Catalogue'];
export type AuditEntry = Schemas['AuditEntryOut'];
export type AuditChainCheck = Schemas['ChainCheckOut'];
export type IdentityDocument = Schemas['DocumentOut'];
export type IdentityDocumentKind = IdentityDocument['kind'];
/** JPEG, PNG or HEIC (FR-REG-010). */
export type IdentityImageType = keyof operations['upload_my_document_v1_identity_me_documents__kind__put']['requestBody']['content'];
export type EvidenceLink = Schemas['ViewLinkOut'];
export type EvidenceView = Schemas['EvidenceViewOut'];
export type IdentityReview = Schemas['MyReviewOut'];
export type IdentityRoute = IdentityReview['route'];
export type ReviewSummary = Schemas['ReviewSummaryOut'];
export type ReviewState = ReviewSummary['state'];
export type ReviewFile = Schemas['ReviewFileOut'];
export type ReviewCounts = Schemas['QueueCountsOut'];
export type ReviewDecisionInput = Schemas['DecisionInput'];

/** A response other than 2xx. `code` is the API's error code, e.g. "invalid_credentials". */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Seconds to wait before trying again, when the API sent Retry-After (sign-in lockout). */
  readonly retryAfter: number | null;
  /** Why an action was refused, e.g. ["tier_not_below_yours"] for "assignment_refused". */
  readonly problems: string[];

  constructor(status: number, code: string, retryAfter: number | null, problems: string[] = []) {
    super(`API request failed: ${status} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.problems = problems;
  }
}

export interface ApiClientOptions {
  /** The public API address, e.g. "https://178.128.126.35.nip.io". Never a secret. */
  baseUrl: string;
  /**
   * Mobile apps return the stored session token here; it is sent as a Bearer
   * header. Browsers leave this out and rely on the HttpOnly session cookie.
   */
  getToken?: () => string | null | Promise<string | null>;
  /** Replaces the global fetch, e.g. in tests. */
  fetch?: typeof fetch;
}

export interface AuditFilters {
  actorId?: string;
  action?: string;
  /** For paging: entries older than this id. */
  beforeId?: number;
  limit?: number;
}

export interface ReviewFilters {
  /** Open reviews (submitted, in review, needs update) when left out. */
  states?: ReviewState[];
  /** Only reviews the caller has claimed. */
  mine?: boolean;
  /** A review reference, e.g. "VR-00421". */
  ref?: string;
  limit?: number;
}

export function createApiClient({ baseUrl, getToken, fetch: fetchImpl = globalThis.fetch }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  /** Sends `body` as JSON, or as it is when `rawType` names its media type (image uploads). */
  async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, rawType?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = rawType ?? 'application/json';
    const token = await getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : rawType ? (body as BodyInit) : JSON.stringify(body),
      // Sends the session cookie when the dashboard and API are on different origins.
      credentials: 'include',
    });
    if (!response.ok) throw await toApiError(response);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  return {
    /** The API process is running. */
    checkHealth: () => request<HealthStatus>('GET', '/v1/health'),
    /** The API can reach PostgreSQL; throws ApiError(503) when it cannot. */
    checkDatabase: () => request<HealthStatus>('GET', '/v1/health/db'),
    /** Throws ApiError "invalid_credentials" (401) or "too_many_attempts" (429, with retryAfter). */
    signIn: (nic: string, password: string) => request<SignInResponse>('POST', '/v1/auth/sign-in', { nic, password }),
    /** Ends every session of the signed-in member. */
    signOut: () => request<void>('POST', '/v1/auth/sign-out'),
    /** Throws ApiError "unauthorized" or "session_expired" (401) without a valid session. */
    getMyProfile: () => request<MemberProfile>('GET', '/v1/members/me'),

    /** The signed-in person's staff assignments; empty for members. The API still checks every action. */
    getMyAccess: () => request<Assignment[]>('GET', '/v1/access/me'),
    /** Tiers and the permission matrix, for the W09 form. Needs roles.assign. */
    getAccessCatalogue: () => request<AccessCatalogue>('GET', '/v1/access/catalogue'),
    /** Checks an assignment without saving it (RB-06). Needs roles.assign. */
    previewAssignment: (input: AssignmentInput) => request<AssignmentPreview>('POST', '/v1/access/assignments/preview', input),
    /** Throws ApiError "assignment_refused" (403) with `problems` when a rule forbids it. */
    createAssignment: (input: AssignmentInput) => request<Assignment>('POST', '/v1/access/assignments', input),
    revokeAssignment: (assignmentId: string, reason: string) =>
      request<Assignment>('POST', `/v1/access/assignments/${encodeURIComponent(assignmentId)}/revoke`, { reason }),

    /** Newest first. Needs audit.view; a regional auditor sees only their region. */
    listAuditEntries: (filters: AuditFilters = {}) => request<AuditEntry[]>('GET', `/v1/audit${toQuery(filters)}`),
    /** Recomputes the audit hash chain. Needs audit.view with platform scope. */
    verifyAuditChain: () => request<AuditChainCheck>('GET', '/v1/audit/verify'),

    /** Which identity images the server holds for the signed-in member; never the images (BR-021). */
    getMyIdentityDocuments: () => request<IdentityDocument[]>('GET', '/v1/identity/me/documents'),
    /**
     * Uploads or replaces one identity image, at most 10 MB. The returned record is the server's
     * acknowledgement: delete the device's copy after it (FR-REG-035). Throws ApiError
     * "unsupported_type" (415), "too_large" (413) or "empty_file" (400).
     */
    uploadIdentityDocument: (kind: IdentityDocumentKind, image: Blob | ArrayBuffer, contentType: IdentityImageType) =>
      request<IdentityDocument>('PUT', `/v1/identity/me/documents/${kind}`, image, contentType),
    /** When reviewers viewed the member's identity evidence: date and role only (FR-AUTH-024). */
    getMyEvidenceViews: () => request<EvidenceView[]>('GET', '/v1/identity/me/evidence-views'),
    /** A member's identity images, without the images. Needs members.view_identity_evidence over their area. */
    getMemberIdentityDocuments: (memberId: string) =>
      request<IdentityDocument[]>('GET', `/v1/identity/members/${encodeURIComponent(memberId)}/documents`),
    /**
     * Opens one identity image for the caller alone, for 5 minutes, and logs it. Load `url` with the
     * same session (cookie or Bearer header); the API refuses it after `expiresAt` or for anyone else.
     */
    openEvidence: async (documentId: string): Promise<EvidenceLink> => {
      const link = await request<EvidenceLink>(
        'POST',
        `/v1/identity/documents/${encodeURIComponent(documentId)}/view-link`,
      );
      return { ...link, url: `${root}${link.url}` };
    },

    /** The member's latest identity review, or null before the first submission. */
    getMyIdentityReview: () => request<IdentityReview | null>('GET', '/v1/identity/me/review'),
    /**
     * Sends the images for team review, or a correction back to the same review. Pass `declaration: true`
     * only after the member confirms the documents are theirs and correct (BR-011). Throws ApiError
     * "submission_refused" (409) with `problems` such as "missing:selfie" or "not_updated:nic_back".
     */
    submitIdentityReview: (route: IdentityRoute, declaration: true) =>
      request<IdentityReview>('POST', '/v1/identity/me/review', { route, declaration }),

    /** W01: reviews in the caller's areas, oldest waiting first. Needs members.verify. */
    listIdentityReviews: (filters: ReviewFilters = {}) =>
      request<ReviewSummary[]>('GET', `/v1/identity/reviews${toReviewQuery(filters)}`),
    getIdentityReviewCounts: () => request<ReviewCounts>('GET', '/v1/identity/reviews/counts'),
    /** W02 without the images. Throws ApiError "own_record" or "outside_your_area" (403). */
    getIdentityReview: (reviewId: string) => request<ReviewFile>('GET', `/v1/identity/reviews/${encodeURIComponent(reviewId)}`),
    /** Takes the review and opens its evidence to the caller. Throws ApiError "claimed_by_another" (409). */
    claimIdentityReview: (reviewId: string) =>
      request<ReviewFile>('POST', `/v1/identity/reviews/${encodeURIComponent(reviewId)}/claim`),
    releaseIdentityReview: (reviewId: string) =>
      request<ReviewFile>('POST', `/v1/identity/reviews/${encodeURIComponent(reviewId)}/release`),
    /** Throws ApiError "decision_refused" (422) with `problems`, e.g. "checklist_incomplete:readable". */
    decideIdentityReview: (reviewId: string, input: ReviewDecisionInput) =>
      request<ReviewFile>('POST', `/v1/identity/reviews/${encodeURIComponent(reviewId)}/decision`, input),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function toQuery(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.actorId) params.set('actor_id', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.beforeId !== undefined) params.set('before_id', String(filters.beforeId));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toReviewQuery(filters: ReviewFilters): string {
  const params = new URLSearchParams();
  for (const state of filters.states ?? []) params.append('state', state);
  if (filters.mine) params.set('mine', 'true');
  if (filters.ref) params.set('ref', filters.ref);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfter = Number(response.headers.get('retry-after'));
  let code = `http_${response.status}`;
  let problems: string[] = [];
  try {
    const { detail } = (await response.json()) as { detail?: unknown };
    if (typeof detail === 'string') {
      code = detail;
    } else if (Array.isArray(detail)) {
      code = 'invalid_request'; // FastAPI field validation
    } else if (detail && typeof detail === 'object' && 'code' in detail) {
      // A refusal with reasons: {"code": "assignment_refused", "problems": [...]}
      const refusal = detail as { code: unknown; problems?: unknown };
      code = String(refusal.code);
      problems = Array.isArray(refusal.problems) ? refusal.problems.map(String) : [];
    }
  } catch {
    // Not JSON (e.g. a proxy error page); keep the HTTP status as the code.
  }
  return new ApiError(response.status, code, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null, problems);
}
