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
export type MyMembership = Schemas['MyMembershipOut'];
export type MembershipState = MyMembership['state'];
export type MembershipFile = Schemas['MembershipFileOut'];
export type MembershipChangeInput = Schemas['MembershipChangeInput'];
export type AwaitingMember = Schemas['AwaitingMemberOut'];
export type MemberCard = Schemas['CardOut'];
export type MemberCardCode = Schemas['CardCodeOut'];
export type CardScan = Schemas['ScanOut'];
export type SignInResponse = Schemas['SignInResponse'];
export type RegistrationInput = Schemas['RegistrationInput'];
export type Registration = Schemas['RegistrationOut'];
export type Notices = Schemas['NoticesOut'];
export type RegistrationProgress = Schemas['ProgressOut'];
export type Place = Schemas['PlaceOut'];
export type AccountNumber = Schemas['AccountNumber'];
export type SignedInSession = Schemas['SessionOut'];
export type MfaStatus = Schemas['MfaStatusOut'];
export type TotpEnrolment = Schemas['TotpEnrolmentOut'];
export type CodeSent = Schemas['CodeSentOut'];
export type EventSummary = Schemas['EventSummaryOut'];
export type EventDetail = Schemas['EventDetailOut'];
export type RsvpResponse = Schemas['RsvpInput']['response'];
export type RsvpState = Schemas['RsvpOut']['response'];
export type EventPass = Schemas['EventPassOut'];
export type EventPassCode = Schemas['PassCodeOut'];
export type ManagedEvent = Schemas['ManagedEventOut'];
export type EventCreateInput = Schemas['EventCreateIn'];
export type EventUpdateInput = Schemas['EventUpdateIn'];
export type PassScan = Schemas['PassScanOut'];
export type EventRoster = Schemas['RosterOut'];
export type EventFilters = {
  /** 'mine' (the default) narrows to the member's area; 'all' widens it (BR-057). */
  scope?: 'mine' | 'all';
  area?: string;
  until?: string;
  type?: string;
  participation?: RsvpState;
  q?: string;
  limit?: number;
};
export type ResetToken = Schemas['ResetTokenOut'];
export type AssistedRecoveryInput = Schemas['AssistedRecoveryInput'];
export type AssistedRecoveryRequest = Schemas['AssistedRequestOut'];
export type AssistedResolutionInput = Schemas['AssistedResolutionInput'];
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
export type IdentityAppeal = Schemas['AppealOut'];
export type AppealSummary = Schemas['AppealSummaryOut'];
export type AppealState = AppealSummary['state'];
export type AppealFile = Schemas['AppealFileOut'];
export type AppealDecisionInput = Schemas['AppealDecisionInput'];
export type DuplicateCase = Schemas['CaseSummaryOut'];
export type DuplicateCaseState = DuplicateCase['state'];
export type DuplicateCaseFile = Schemas['CaseFileOut'];
export type DuplicateReportInput = Schemas['ReportInput'];
export type DuplicateDecisionInput = Schemas['CaseDecisionInput'];
export type DuplicateFlag = Schemas['DuplicateFlagOut'];

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
  /**
   * A stable id for this app install, sent as X-Device-Id, so sign-ins from a new
   * device can be noticed (FR-AUTH-019). Not personal data; browsers leave it out.
   */
  deviceId?: string;
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

export interface AppealFilters {
  /** Open appeals (submitted, in review) when left out. */
  states?: AppealState[];
  /** Only appeals the caller has claimed. */
  mine?: boolean;
  limit?: number;
}

export function createApiClient({ baseUrl, getToken, fetch: fetchImpl = globalThis.fetch, deviceId }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  /** Sends `body` as JSON, or as it is when `rawType` names its media type (image uploads). */
  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, body?: unknown, rawType?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = rawType ?? 'application/json';
    const token = await getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (deviceId) headers['X-Device-Id'] = deviceId;

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
    /** For accounts registered with a passport (FR-AUTH-005). Same errors as signIn. */
    signInWithPassport: (passportNumber: string, passportCountry: string, password: string) =>
      request<SignInResponse>('POST', '/v1/auth/sign-in', { passportNumber, passportCountry, password }),
    /**
     * Creates an account and signs it in (A03). Throws ApiError "registration_refused" (422) with
     * `problems`, or "already_registered" (409): offer sign-in and recovery instead.
     */
    register: (input: RegistrationInput) => request<Registration>('POST', '/v1/identity/register', input),
    /** The notice versions to show; consent is given against them. */
    getNotices: () => request<Notices>('GET', '/v1/identity/notices'),
    /** A04: consent to identity review before any upload. Throws ApiError "notice_outdated" (409). */
    giveIdentityConsent: (noticeVersion: string) =>
      request<void>('POST', '/v1/identity/me/consent', { noticeVersion }),
    /** Each registration step and the next one (A18). */
    getMyRegistrationProgress: () => request<RegistrationProgress>('GET', '/v1/identity/me/progress'),
    /** The confirmed recovery number, or null. */
    getMyRecoveryPhone: () => request<{ phone: string } | null>('GET', '/v1/identity/me/phone'),
    /**
     * Sends a code to a new number (FR-REG-028), whether or not another account has it.
     * Throws ApiError "too_many_requests" (429, retryAfter) or "sms_not_configured" (503).
     */
    requestPhoneConfirmation: (phone: string) => request<CodeSent>('POST', '/v1/identity/me/phone', { phone }),
    /**
     * The number becomes the recovery contact. Throws ApiError "invalid_code" or "too_many_attempts" (401),
     * or "phone_unavailable" (409) when another account already has the number.
     */
    confirmPhone: (phone: string, code: string) =>
      request<{ phone: string }>('POST', '/v1/identity/me/phone/confirm', { phone, code }),
    /** A16: the answer is the same whether or not the number is registered (BR-023); the SMS follows it. */
    requestRecovery: (account: AccountNumber) => request<CodeSent>('POST', '/v1/auth/recovery/request', account),
    /** A correct code returns a reset token valid for 10 minutes. */
    verifyRecovery: (account: AccountNumber, code: string) =>
      request<ResetToken>('POST', '/v1/auth/recovery/verify', { ...account, code }),
    /** Ends every session of the account. Throws ApiError "password_refused" (422) or "invalid_reset_token" (401). */
    resetPassword: (resetToken: string, newPassword: string) =>
      request<void>('POST', '/v1/auth/recovery/reset', { resetToken, newPassword }),
    /** For someone who cannot use their recovery contact: returns a reference (FR-AUTH-017). */
    requestAssistedRecovery: (input: AssistedRecoveryInput) =>
      request<{ reference: string }>('POST', '/v1/auth/recovery/assisted', input),
    /** Open assisted-recovery requests in the caller's areas. Needs members.verify. */
    listRecoveryRequests: () => request<AssistedRecoveryRequest[]>('GET', '/v1/identity/recovery-requests'),
    resolveRecoveryRequest: (requestId: string, input: AssistedResolutionInput) =>
      request<AssistedRecoveryRequest>('POST', `/v1/identity/recovery-requests/${encodeURIComponent(requestId)}/resolve`, input),
    /** Dependent area lists: district, then DS division, then GN division. */
    listDistricts: () => request<Place[]>('GET', '/v1/geography/districts'),
    listDsDivisions: (districtCode: string) =>
      request<Place[]>('GET', `/v1/geography/districts/${encodeURIComponent(districtCode)}/ds-divisions`),
    listGnDivisions: (dsCode: string) =>
      request<Place[]>('GET', `/v1/geography/ds-divisions/${encodeURIComponent(dsCode)}/gn-divisions`),
    /** Ends every session of the signed-in member; an old or ended token only clears the cookie. */
    signOut: () => request<void>('POST', '/v1/auth/sign-out'),
    /** The member's signed-in devices (FR-AUTH-020). */
    listMySessions: () => request<SignedInSession[]>('GET', '/v1/auth/sessions'),
    /** Ends one session; its next request is refused. */
    revokeSession: (sessionId: string) =>
      request<void>('POST', `/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`),
    revokeOtherSessions: () => request<void>('POST', '/v1/auth/sessions/revoke-others'),
    /** Whether an authenticator is enrolled and the second factor was given in this session. */
    getMfaStatus: () => request<MfaStatus>('GET', '/v1/auth/mfa'),
    /** Starts adding an authenticator app; show the secret or the URI as a QR code once. */
    startTotpEnrolment: () => request<TotpEnrolment>('POST', '/v1/auth/mfa/totp'),
    /** The first code enables the authenticator. Throws ApiError "invalid_code" (401) or "mfa_locked" (429, retryAfter). */
    confirmTotp: (code: string) => request<void>('POST', '/v1/auth/mfa/totp/confirm', { code }),
    /**
     * Gives the second factor for this session; staff endpoints answer "mfa_required" (403) until then.
     * Throws ApiError "invalid_code" or "too_many_attempts" (401; the session is ended), or "mfa_locked"
     * (429, retryAfter): five wrong codes in any sessions lock the authenticator, for longer each time.
     */
    verifyMfa: (code: string) => request<void>('POST', '/v1/auth/mfa/verify', { code }),
    /** Throws ApiError "unauthorized" or "session_expired" (401) without a valid session. */
    getMyProfile: () => request<MemberProfile>('GET', '/v1/members/me'),
    /** Pending, active, suspended or inactive, with the reason code. The card shows only when active. */
    getMyMembership: () => request<MyMembership>('GET', '/v1/membership/me'),
    /** C01, or the C06 explanation (available: false, with the membership state and reason). */
    getMyCard: () => request<MemberCard>('GET', '/v1/membership/me/card'),
    /**
     * C02: a signed code valid for 60 seconds; ask again after refreshAfterSeconds.
     * Throws ApiError "card_not_available" (409) unless identity is Verified and membership Active.
     */
    getMyCardCode: () => request<MemberCardCode>('GET', '/v1/membership/me/card/code'),
    /** Checks a member's code: valid (name and member ID only), expired or not_valid. Needs events.checkin_scan. */
    scanMemberCard: (code: string) => request<CardScan>('POST', '/v1/membership/card/scan', { code }),
    /** Verified members still pending, in the caller's areas. Needs members.activate. */
    listAwaitingActivation: (limit?: number) =>
      request<AwaitingMember[]>('GET', `/v1/membership/awaiting-activation${limit === undefined ? '' : `?limit=${limit}`}`),
    getMembership: (memberId: string) => request<MembershipFile>('GET', `/v1/membership/members/${encodeURIComponent(memberId)}`),
    /** Activate, suspend, reinstate or inactivate, with a reason. Throws ApiError "change_refused" (422) with `problems`. */
    changeMembership: (memberId: string, input: MembershipChangeInput) =>
      request<MembershipFile>('POST', `/v1/membership/members/${encodeURIComponent(memberId)}/changes`, input),

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
     * "unsupported_type" (415), "too_large" (413), "empty_file" (400) or "upload_limit" (429, retryAfter:
     * 12 images in 24 hours).
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

    /**
     * Appeals the member's latest Request-update or Unable-to-verify decision, once (M04), in up to
     * 1,000 characters. Throws ApiError "appeal_refused" (409) with "nothing_to_appeal" or "appeal_used".
     */
    appealMyIdentityDecision: (statement: string) =>
      request<IdentityReview>('POST', '/v1/identity/me/review/appeal', { statement }),
    /** D05: appeals in the caller's areas, oldest first. Needs idv.appeal.decide. */
    listIdentityAppeals: (filters: AppealFilters = {}) =>
      request<AppealSummary[]>('GET', `/v1/identity/appeals${toQueueQuery(filters)}`),
    getIdentityAppeal: (appealId: string) => request<AppealFile>('GET', `/v1/identity/appeals/${encodeURIComponent(appealId)}`),
    /** Throws ApiError "original_reviewer" (409) for the person who made the decision under appeal. */
    claimIdentityAppeal: (appealId: string) =>
      request<AppealFile>('POST', `/v1/identity/appeals/${encodeURIComponent(appealId)}/claim`),
    releaseIdentityAppeal: (appealId: string) =>
      request<AppealFile>('POST', `/v1/identity/appeals/${encodeURIComponent(appealId)}/release`),
    /** Uphold or overturn, with a reason the member sees. Overturning sends the review back for a fresh decision. */
    decideIdentityAppeal: (appealId: string, input: AppealDecisionInput) =>
      request<AppealFile>('POST', `/v1/identity/appeals/${encodeURIComponent(appealId)}/decision`, input),

    /** Report that a member may hold another account (needs members.verify). An existing pair returns its case. */
    reportDuplicate: (input: DuplicateReportInput) => request<DuplicateCase>('POST', '/v1/identity/duplicates', input),
    /** D04: open duplicate investigations in the caller's areas. Needs idv.duplicate.investigate. */
    listDuplicateCases: (filters: { states?: DuplicateCaseState[]; mine?: boolean; limit?: number } = {}) =>
      request<DuplicateCase[]>('GET', `/v1/identity/duplicates${toQueueQuery(filters)}`),
    getDuplicateCase: (caseId: string) => request<DuplicateCaseFile>('GET', `/v1/identity/duplicates/${encodeURIComponent(caseId)}`),
    claimDuplicateCase: (caseId: string) =>
      request<DuplicateCaseFile>('POST', `/v1/identity/duplicates/${encodeURIComponent(caseId)}/claim`),
    releaseDuplicateCase: (caseId: string) =>
      request<DuplicateCaseFile>('POST', `/v1/identity/duplicates/${encodeURIComponent(caseId)}/release`),
    /** Record the finding with a reason. It changes neither account. */
    decideDuplicateCase: (caseId: string, input: DuplicateDecisionInput) =>
      request<DuplicateCaseFile>('POST', `/v1/identity/duplicates/${encodeURIComponent(caseId)}/decision`, input),

    /** E01: events still to come with the member's response; cancelled ones stay listed as cancelled. */
    listEvents: (filters: EventFilters = {}) => request<EventSummary[]>('GET', `/v1/events${toEventQuery(filters)}`),
    /** E04. Throws ApiError "not_found" (404) for drafts and unknown events. */
    getEvent: (eventId: string) => request<EventDetail>('GET', `/v1/events/${encodeURIComponent(eventId)}`),
    /**
     * E05: going, maybe or declined; the answer is the state recorded ("waitlisted" when the event is full).
     * Throws ApiError "event_cancelled" or "event_over" (409).
     */
    respondToEvent: (eventId: string, response: RsvpResponse) =>
      request<{ response: RsvpState }>('PUT', `/v1/events/${encodeURIComponent(eventId)}/rsvp`, { response }),
    /** E06. Throws ApiError "not_going", "membership_not_active", "event_cancelled" or "event_over" (409). */
    getEventPass: (eventId: string) => request<EventPass>('GET', `/v1/events/${encodeURIComponent(eventId)}/pass`),
    /** A pass code valid for 60 seconds; show it black on white and ask again at expiresAt. */
    getEventPassCode: (eventId: string) =>
      request<EventPassCode>('GET', `/v1/events/${encodeURIComponent(eventId)}/pass/code`),

    /** Events in the caller's areas, drafts included. Needs events.manage. */
    listManagedEvents: (filters: { states?: readonly ('draft' | 'published' | 'cancelled')[]; limit?: number } = {}) =>
      request<ManagedEvent[]>('GET', `/v1/events/manage${toQueueQuery(filters)}`),
    getManagedEvent: (eventId: string) =>
      request<ManagedEvent>('GET', `/v1/events/manage/${encodeURIComponent(eventId)}`),
    /** A draft. Throws ApiError "event_invalid" (422) with `problems`, or "outside_your_area" (403). */
    createEvent: (input: EventCreateInput) => request<ManagedEvent>('POST', '/v1/events', input),
    /** Only the fields given change; `notified` counts members told of a new time or place. */
    updateEvent: (eventId: string, input: EventUpdateInput) =>
      request<ManagedEvent>('PATCH', `/v1/events/${encodeURIComponent(eventId)}`, input),
    publishEvent: (eventId: string) => request<ManagedEvent>('POST', `/v1/events/${encodeURIComponent(eventId)}/publish`),
    /** Every pass stops working; members who responded are told by SMS. */
    cancelEvent: (eventId: string, reason: string) =>
      request<ManagedEvent>('POST', `/v1/events/${encodeURIComponent(eventId)}/cancel`, { reason }),
    /**
     * Checks a pass in at this event: checked_in, already_checked_in, expired (ask the member to refresh),
     * wrong_event, outside_window or not_valid. Needs events.checkin_scan over the event's area.
     */
    scanEventPass: (eventId: string, code: string) =>
      request<PassScan>('POST', `/v1/events/${encodeURIComponent(eventId)}/scan`, { code }),
    /** S09: expected and attended counts with the roster. */
    getEventAttendance: (eventId: string) =>
      request<EventRoster>('GET', `/v1/events/${encodeURIComponent(eventId)}/attendance`),
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

function toQueueQuery(filters: { states?: readonly string[]; mine?: boolean; limit?: number }): string {
  const params = new URLSearchParams();
  for (const state of filters.states ?? []) params.append('state', state);
  if (filters.mine) params.set('mine', 'true');
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toEventQuery(filters: EventFilters): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(name, String(value));
  }
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
