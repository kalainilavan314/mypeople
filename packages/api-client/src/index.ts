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
export type MemberLookup = Schemas['MemberLookupOut'];
export type MemberCard = Schemas['CardOut'];
export type MemberCardCode = Schemas['CardCodeOut'];
export type CardScan = Schemas['ScanOut'];
export type SignInResponse = Schemas['SignInResponse'];
export type SessionTokens = Schemas['TokensOut'];
export type SecurityAlert = Schemas['SecurityAlertOut'];
export type SecurityAlertAnswer = Schemas['AlertAnswerIn']['answer'];
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
export type EventType = Schemas['EventCreateIn']['eventType'];
export type AreaLevel = Schemas['AreaRef']['level'];
export type PassScan = Schemas['PassScanOut'];
export type ManualCheckIn = Schemas['ManualCheckInOut'];
export type EventRoster = Schemas['RosterOut'];
export type HomeView = Schemas['HomeOut'];
export type AlbumSummary = Schemas['AlbumSummaryOut'];
export type AlbumDetail = Schemas['AlbumDetailOut'];
export type GalleryPhoto = Schemas['GalleryPhotoOut'];
export type ManagedAlbum = Schemas['ManagedAlbumOut'];
export type AlbumCreateInput = Schemas['AlbumCreateIn'];
export type AlbumUpdateInput = Schemas['AlbumUpdateIn'];
export type AlbumCategory = Schemas['AlbumCreateIn']['category'];
export type PhotoCaptionsInput = Schemas['PhotoCaptionsIn'];
export type RemovalRequestInput = Schemas['RemovalRequestIn'];
export type PublicRemovalRequestInput = Schemas['PublicRemovalRequestIn'];
export type RemovalReceipt = Schemas['RemovalReceiptOut'];
export type QueuedRemoval = Schemas['QueuedRemovalOut'];
export type RemovalDecisionInput = Schemas['RemovalDecisionIn'];
export type GalleryImageType = 'image/jpeg' | 'image/png' | 'image/webp';
export type ProfileView = Schemas['ProfileOut'];
export type ProfileUpdateInput = Schemas['ProfileUpdateIn'];
export type ActivityItem = Schemas['ActivityItemOut'];
export type ActivityKind = ActivityItem['kind'];
export type IdentityDataItem = Schemas['IdentityDataItemOut'];
export type AreaChange = Schemas['AreaChangeOut'];
export type QueuedAreaChange = Schemas['QueuedAreaChangeOut'];
export type AreaDecisionInput = Schemas['AreaDecisionIn'];
export type PrivacyRequest = Schemas['PrivacyRequestOut'];
export type PrivacyRequestInput = Schemas['PrivacyRequestIn'];
export type PrivacyRegisterEntry = Schemas['RegisterEntryOut'];
export type PrivacyOutcomeInput = Schemas['PrivacyOutcomeIn'];
export type NotificationItem = Schemas['NotificationOut'];
export type NotificationTopic = NotificationItem['topic'];
export type NotificationInbox = Schemas['InboxOut'];
export type NotificationChoices = Schemas['ChoicesOut'];
export type NotificationChoicesInput = Schemas['ChoicesIn'];
export type PushPlatform = Schemas['DeviceIn']['platform'];
export type Broadcast = Schemas['BroadcastOut'];
export type BroadcastPreview = Schemas['BroadcastPreviewOut'];
export type AudienceReach = Schemas['AudienceReachOut'];
export type BroadcastCreateInput = Schemas['BroadcastCreateIn'];
export type BroadcastUpdateInput = Schemas['BroadcastUpdateIn'];
export type EnabledFeatures = Schemas['FeaturesOut'];
export type FeatureFlag = Schemas['FlagOut'];
export type PhaseGate = FeatureFlag['requiredGate'];
export type ElectionBanner = Schemas['ElectionBannerOut'];
export type ElectionNotice = Schemas['ElectionNoticeOut'];
export type ElectionNoticeInput = Schemas['NoticeIn'];
export type ElectionPeriod = Schemas['PeriodOut'];
export type ElectionPeriodState = ElectionPeriod['state'];
export type ElectionPeriodInput = Schemas['PeriodIn'];
export type DeclaredElectionPeriod = Schemas['DeclaredOut'];
export type ElectionPeriodFile = Schemas['PeriodFileOut'];
export type WorkQueues = Schemas['WorkQueuesOut'];
export type CommunityReportsQueueCount = Schemas['CommunityReportsQueueCount'];
export type CommunityReportSummary = Schemas['CommunityReportSummaryOut'];
export type CommunityReportList = Schemas['CommunityReportListOut'];
export type CommunityReportStatus = Schemas['CommunityReportSummaryOut']['status'];
export type Household = Schemas['HouseholdOut'];
export type HouseholdMember = Schemas['HouseholdMemberOut'];
export type HouseholdInvitation = Schemas['HouseholdInvitationOut'];
export type HouseholdCreateInput = Schemas['HouseholdCreateIn'];
export type HouseholdUpdateInput = Schemas['HouseholdUpdateIn'];
export type InviteAdultInput = Schemas['InviteAdultIn'];
export type InvitationRespondInput = Schemas['InvitationRespondIn'];
export type ConsentNotice = Schemas['ConsentNoticeOut'];
export type ConsentLog = Schemas['ConsentLogOut'];
export type InvitationsList = Schemas['InvitationsListOut'];
export type StaffHouseholdView = Schemas['StaffHouseholdViewOut'];
export type FundConfig = Schemas['FundConfigResponse'];
export type ContributionCreateInput = Omit<Schemas['ContributionCreateRequest'], 'currency' | 'declarationVersion'> & {
  currency?: 'LKR';
  declarationVersion?: string;
};
export type ContributionDetail = Schemas['ContributionDetailResponse'];
export type ContributionReceipt = Schemas['ReceiptResponse'];
export type StaffContributionsList = Schemas['StaffContributionsListResponse'];
export type StaffContributionSummary = Schemas['StaffContributionSummary'];
export type StaffContributionDetail = Schemas['StaffContributionDetail'];
export type StaffSlipViewToken = Schemas['StaffSlipViewTokenResponse'];
export type StaffReconcileInput = Schemas['StaffReconcileRequest'];
export type StaffApproveInput = Schemas['StaffApproveRequest'];
export type FinanceContributionFilters = {
  status?: string;
  month?: string;
  riskFlag?: string;
  reference?: string;
  mine?: boolean;
  limit?: number;
  offset?: number;
};
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
export type AssignmentPreviewInput = Schemas['AssignmentPreviewCreateInput'];
export type AssignmentPreviewCreated = Schemas['AssignmentPreviewCreatedOut'];
export type AssignmentPreviewDetails = Schemas['AssignmentPreviewOut'];
export type Assignment = Schemas['AssignmentOut'];
export type StaffTier = Assignment['tier'];
export type ListedAssignment = Schemas['AssignmentListItemOut'];
export type AssignmentPreview = Schemas['PreviewOut'];
export type AccessCatalogue = Schemas['Catalogue'];
export type DueAccessReviews = Schemas['DueReviewsOut'];
export type DueGrant = Schemas['DueGrantOut'];
export type AccessReviewDecision = Schemas['ReviewInput']['decision'];
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
  /**
   * Mobile apps renew an expired token here (FR-AUTH-025): call refreshSession with the
   * stored refresh token, keep both new tokens, and return the new token, or null when the
   * session has ended. A request refused with "token_expired" is sent once more with it.
   */
  refresh?: () => Promise<string | null>;
  /** Replaces the global fetch, e.g. in tests. */
  fetch?: typeof fetch;
  /** Native upload transport; injectable for byte-progress tests. */
  xhrFactory?: () => XMLHttpRequest;
  /**
   * A stable id for this app install, sent as X-Device-Id, so sign-ins from a new
   * device can be noticed (FR-AUTH-019). Not personal data; browsers leave it out.
   */
  deviceId?: string;
  /**
   * The browser's address, when a server (the dashboard) calls the API for a staff
   * member. Sent as X-Forwarded-For; the API uses it only when it trusts the caller as
   * its proxy (uvicorn --forwarded-allow-ips), so sign-in limits and the audit log see
   * the real address rather than the dashboard's.
   */
  forwardedFor?: string;
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
  offset?: number;
}

export interface AppealFilters {
  /** Open appeals (submitted, in review) when left out. */
  states?: AppealState[];
  /** Only appeals the caller has claimed. */
  mine?: boolean;
  limit?: number;
  offset?: number;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function createApiClient({
  baseUrl,
  getToken,
  refresh,
  fetch: fetchImpl = globalThis.fetch,
  xhrFactory,
  deviceId,
  forwardedFor,
}: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  /** Sends `body` as JSON, or as it is when `rawType` names its media type (image uploads). */
  function send(
    method: Method,
    path: string,
    token: string | null | undefined,
    body?: unknown,
    rawType?: string,
    extraHeaders?: Record<string, string>,
  ) {
    const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = rawType ?? 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (deviceId) headers['X-Device-Id'] = deviceId;
    if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;

    return fetchImpl(`${root}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : rawType ? (body as BodyInit) : JSON.stringify(body),
      // Sends the session cookie when the dashboard and API are on different origins.
      credentials: 'include',
    });
  }

  async function request<T>(
    method: Method,
    path: string,
    body?: unknown,
    rawType?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    let response = await send(method, path, await getToken?.(), body, rawType, extraHeaders);
    if (response.status === 401 && refresh) {
      const error = await toApiError(response);
      // The 15-minute token ran out: renew it once and try again.
      const renewed = error.code === 'token_expired' ? await refresh() : null;
      if (!renewed) throw error;
      response = await send(method, path, renewed, body, rawType, extraHeaders);
    }
    if (!response.ok) throw await toApiError(response);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  /** XHR supplies actual transmitted-byte progress, which fetch does not expose on React Native. */
  async function uploadImage(
    path: string,
    image: Blob | ArrayBuffer,
    contentType: IdentityImageType,
    onProgress: (sent: number, total: number) => void,
  ): Promise<IdentityDocument> {
    const total = image instanceof ArrayBuffer ? image.byteLength : image.size;
    if (!xhrFactory && typeof XMLHttpRequest === 'undefined') {
      const result = await request<IdentityDocument>('PUT', path, image, contentType);
      onProgress(total, total);
      return result;
    }
    const sendImage = (token: string | null | undefined): Promise<Response> => new Promise((resolve, reject) => {
      const xhr = xhrFactory ? xhrFactory() : new XMLHttpRequest();
      xhr.open('PUT', `${root}${path}`);
      xhr.timeout = 120_000;
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', contentType);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (deviceId) xhr.setRequestHeader('X-Device-Id', deviceId);
      xhr.upload.onprogress = (event) => onProgress(Math.min(event.loaded, total), total);
      xhr.onload = () => {
        const headers = new Headers({ 'content-type': xhr.getResponseHeader('Content-Type') ?? 'application/json' });
        const retryAfter = xhr.getResponseHeader('Retry-After');
        if (retryAfter) headers.set('Retry-After', retryAfter);
        resolve(new Response(xhr.responseText, { status: xhr.status, headers }));
      };
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.ontimeout = () => reject(new TypeError('Upload timed out'));
      xhr.onabort = () => reject(new TypeError('Upload interrupted'));
      xhr.send(image);
    });

    let response = await sendImage(await getToken?.());
    if (response.status === 401 && refresh) {
      const error = await toApiError(response);
      const renewed = error.code === 'token_expired' ? await refresh() : null;
      if (!renewed) throw error;
      onProgress(0, total);
      response = await sendImage(renewed);
    }
    if (!response.ok) throw await toApiError(response);
    const document = await response.json() as IdentityDocument;
    onProgress(total, total);
    return document;
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
     * The number becomes the recovery contact. Replacing one also needs the current password.
     * Throws ApiError "invalid_code", "too_many_attempts" or "wrong_password" (401),
     * "too_many_requests" (429), or "phone_unavailable" (409).
     */
    confirmPhone: (phone: string, code: string, currentPassword?: string) =>
      request<{ phone: string }>('POST', '/v1/identity/me/phone/confirm', { phone, code, currentPassword }),
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
    /**
     * A new token and refresh token (FR-AUTH-025); the one sent stops working. Browsers leave it
     * out and send the mp_refresh cookie. Throws ApiError (401) "invalid_refresh_token",
     * "session_expired", or "refresh_reused": a used one came back, so the session has ended
     * everywhere and the member is alerted.
     */
    refreshSession: (refreshToken?: string) =>
      request<SessionTokens>('POST', '/v1/auth/refresh', { refreshToken: refreshToken ?? null }),
    /** M50: flagged sign-ins and reused refresh tokens, newest first. */
    listSecurityAlerts: () => request<SecurityAlert[]>('GET', '/v1/auth/security-alerts'),
    /**
     * "it_was_me" closes the alert; "not_me" ends the flagged session and every other one except
     * this one. Throws ApiError "not_found" (404) or "already_answered" (409).
     */
    answerSecurityAlert: (alertId: string, answer: SecurityAlertAnswer) =>
      request<SecurityAlert>('POST', `/v1/auth/security-alerts/${encodeURIComponent(alertId)}/answer`, { answer }),
    /** The member's signed-in devices (FR-AUTH-020). */
    listMySessions: () => request<SignedInSession[]>('GET', '/v1/auth/sessions'),
    /** Ends one session; its next request is refused. */
    revokeSession: (sessionId: string) =>
      request<void>('POST', `/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`),
    revokeOtherSessions: () => request<void>('POST', '/v1/auth/sessions/revoke-others'),
    /** Whether an authenticator is enrolled and the second factor was given in this session. */
    getMfaStatus: () => request<MfaStatus>('GET', '/v1/auth/mfa'),
    /** Starts adding an authenticator app; show the secret or the URI as a QR code once. */
    startTotpEnrolment: (currentPassword: string) =>
      request<TotpEnrolment>('POST', '/v1/auth/mfa/totp', { currentPassword }),
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
    /** S03: one member in the caller's areas by exact member ID (FR-STF-003); 404 also outside them. Needs members.view_profile. */
    lookupMember: (memberCode: string) =>
      request<MemberLookup>('GET', `/v1/membership/lookup?code=${encodeURIComponent(memberCode)}`),
    listAwaitingActivation: (limit?: number) =>
      request<AwaitingMember[]>('GET', `/v1/membership/awaiting-activation${limit === undefined ? '' : `?limit=${limit}`}`),
    getMembership: (memberId: string) => request<MembershipFile>('GET', `/v1/membership/members/${encodeURIComponent(memberId)}`),
    /** Activate, suspend, reinstate or inactivate, with a reason. Throws ApiError "change_refused" (422) with `problems`. */
    changeMembership: (memberId: string, input: MembershipChangeInput) =>
      request<MembershipFile>('POST', `/v1/membership/members/${encodeURIComponent(memberId)}/changes`, input),

    /** The signed-in person's staff assignments; empty for members. The API still checks every action. */
    getMyAccess: () => request<Assignment[]>('GET', '/v1/access/me'),
    /** D01: Aggregate work queue counts for the caller's permitted areas. Null for unheld permissions. */
    getWorkQueues: () => request<WorkQueues>('GET', '/v1/access/work-queues'),
    /** Tiers and the permission matrix, for the W09 form. Needs roles.assign. */
    getAccessCatalogue: () => request<AccessCatalogue>('GET', '/v1/access/catalogue'),
    /** W09: assignments in the caller's own areas, newest first. Needs roles.assign. */
    listAssignments: (state: 'active' | 'revoked' = 'active') =>
      request<ListedAssignment[]>('GET', `/v1/access/assignments?state=${state}`),
    /** Checks an assignment without saving it (RB-06). Needs roles.assign. */
    previewAssignment: (input: AssignmentInput) => request<AssignmentPreview>('POST', '/v1/access/assignments/preview', input),
    /** Creates a durable 10-minute preview record after rule validation. Needs roles.assign. */
    createAssignmentPreview: (input: AssignmentPreviewInput) =>
      request<AssignmentPreviewCreated>('POST', '/v1/access/assignment-previews', input),
    /** Retrieves an active assignment preview for display. Needs roles.assign. */
    getAssignmentPreview: (previewId: string) =>
      request<AssignmentPreviewDetails>('GET', `/v1/access/assignment-previews/${encodeURIComponent(previewId)}`),
    /** Atomically confirms an assignment preview, creating the role. Needs roles.assign. */
    confirmAssignmentPreview: (previewId: string) =>
      request<Assignment>('POST', `/v1/access/assignment-previews/${encodeURIComponent(previewId)}/confirm`),
    /** Cancels an active assignment preview. Needs roles.assign. */
    cancelAssignmentPreview: (previewId: string) =>
      request<{ status: string }>('POST', `/v1/access/assignment-previews/${encodeURIComponent(previewId)}/cancel`),
    revokeAssignment: (assignmentId: string, reason: string) =>
      request<Assignment>('POST', `/v1/access/assignments/${encodeURIComponent(assignmentId)}/revoke`, { reason }),
    /** D31: grants the caller may review this quarter, the most overdue first (FR-AUTH-027). Needs audit.view. */
    listDueAccessReviews: () => request<DueAccessReviews>('GET', '/v1/access/reviews'),
    /**
     * Confirms a grant for another quarter, or revokes it, with a reason. Throws ApiError (403)
     * "own_assignment", "outside_your_area" or "tier_not_below_yours", "not_found" (404), or
     * "not_due" (409) when it was already reviewed this quarter.
     */
    reviewAssignment: (assignmentId: string, decision: AccessReviewDecision, reason: string) =>
      request<Assignment>('POST', `/v1/access/reviews/${encodeURIComponent(assignmentId)}`, { decision, reason }),

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
    uploadIdentityDocument: (
      kind: IdentityDocumentKind,
      image: Blob | ArrayBuffer,
      contentType: IdentityImageType,
      onProgress?: (sent: number, total: number) => void,
    ) => onProgress
      ? uploadImage(`/v1/identity/me/documents/${kind}`, image, contentType, onProgress)
      : request<IdentityDocument>('PUT', `/v1/identity/me/documents/${kind}`, image, contentType),
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
    listDuplicateCases: (filters: { states?: DuplicateCaseState[]; mine?: boolean; limit?: number; offset?: number } = {}) =>
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
    listManagedEvents: (filters: { states?: readonly ('draft' | 'published' | 'cancelled')[]; limit?: number; offset?: number } = {}) =>
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
    /**
     * FR-VOI-007: checks a member in by the member ID on their card when the pass cannot be scanned.
     * Same rules as a scan; the reason is kept on the attendance record.
     */
    checkInManually: (eventId: string, memberCode: string, reason: string) =>
      request<ManualCheckIn>('POST', `/v1/events/${encodeURIComponent(eventId)}/checkin/manual`, { memberCode, reason }),
    /** S09: expected and attended counts with the roster. */
    getEventAttendance: (eventId: string) =>
      request<EventRoster>('GET', `/v1/events/${encodeURIComponent(eventId)}/attendance`),

    /**
     * The Home tab, decided by the server: layout "active" (H01) or "awaiting_review" (H02), one next step,
     * the next event nearby, and which quick actions, tabs and hub services are open or locked, with why.
     */
    getHome: () => request<HomeView>('GET', '/v1/home'),

    /** G01: published albums, newest first. */
    listAlbums: (filters: { category?: 'events' | 'community'; q?: string; limit?: number } = {}) =>
      request<AlbumSummary[]>('GET', `/v1/content/albums${toEventQuery(filters)}`),
    /** G02. Throws ApiError "not_found" (404) for an album that is not published. */
    getAlbum: (albumId: string) => request<AlbumDetail>('GET', `/v1/content/albums/${encodeURIComponent(albumId)}`),
    /**
     * Where a photo's image is: thumb for grids, display for the viewer. It needs the session (cookie or
     * Bearer header). Show it in the app; offer no download, share or tagging (BR-071).
     */
    galleryPhotoUrl: (photoId: string, size: 'thumb' | 'display') =>
      `${root}/v1/content/photos/${encodeURIComponent(photoId)}/${size}`,
    /** G03 "Request photo removal": a receipt due within 24 hours; asking again returns the same one. */
    requestPhotoRemoval: (photoId: string, input: RemovalRequestInput) =>
      request<RemovalReceipt>('POST', `/v1/content/photos/${encodeURIComponent(photoId)}/removal-requests`, input),
    listMyRemovalRequests: () => request<RemovalReceipt[]>('GET', '/v1/content/removal-requests/mine'),
    /** For someone who is not a member (no session needed). Throws ApiError "too_many_requests" (429). */
    requestPhotoRemovalPublicly: (input: PublicRemovalRequestInput) =>
      request<RemovalReceipt>('POST', '/v1/content/removal-requests/public', input),

    /** Albums in the caller's areas (drafts and submitted by default). Needs gallery.publish. */
    listManagedAlbums: (filters: { states?: readonly ('draft' | 'submitted' | 'published')[]; limit?: number; offset?: number } = {}) =>
      request<AlbumSummary[]>('GET', `/v1/content/albums/manage${toQueueQuery(filters)}`),
    getManagedAlbum: (albumId: string) =>
      request<ManagedAlbum>('GET', `/v1/content/albums/manage/${encodeURIComponent(albumId)}`),
    createAlbum: (input: AlbumCreateInput) => request<ManagedAlbum>('POST', '/v1/content/albums', input),
    updateAlbum: (albumId: string, input: AlbumUpdateInput) =>
      request<ManagedAlbum>('PATCH', `/v1/content/albums/${encodeURIComponent(albumId)}`, input),
    /** Adds a photo to a draft; it is re-encoded as WebP without metadata. Throws "unsupported_type" (415). */
    uploadAlbumPhoto: (albumId: string, image: Blob | ArrayBuffer, contentType: GalleryImageType) =>
      request<GalleryPhoto>('POST', `/v1/content/albums/${encodeURIComponent(albumId)}/photos`, image, contentType),
    updatePhotoCaptions: (photoId: string, input: PhotoCaptionsInput) =>
      request<GalleryPhoto>('PATCH', `/v1/content/photos/${encodeURIComponent(photoId)}`, input),
    deletePhoto: (photoId: string) => request<void>('DELETE', `/v1/content/photos/${encodeURIComponent(photoId)}`),
    /** Throws ApiError "album_invalid" (422) with `problems`, e.g. "tamil_caption_missing". */
    submitAlbum: (albumId: string) =>
      request<ManagedAlbum>('POST', `/v1/content/albums/${encodeURIComponent(albumId)}/submit`),
    /** Throws ApiError "own_submission" (409) for the person who submitted it. */
    publishAlbum: (albumId: string) =>
      request<ManagedAlbum>('POST', `/v1/content/albums/${encodeURIComponent(albumId)}/publish`),
    returnAlbum: (albumId: string, note: string) =>
      request<ManagedAlbum>('POST', `/v1/content/albums/${encodeURIComponent(albumId)}/return`, { note }),
    /** The removal queue, soonest due first, with the 18-hour escalation flag. Needs gallery.takedown. */
    listRemovalRequests: (filters: { states?: readonly ('open' | 'removed' | 'blurred' | 'kept')[]; limit?: number; offset?: number } = {}) =>
      request<QueuedRemoval[]>('GET', `/v1/content/removal-requests${toQueueQuery(filters)}`),
    /** Remove, blur or keep, with a reason. Throws ApiError "already_decided" (409). */
    decideRemovalRequest: (requestId: string, input: RemovalDecisionInput) =>
      request<RemovalReceipt>('POST', `/v1/content/removal-requests/${encodeURIComponent(requestId)}/decision`, input),

    /** P01, P02: what is recorded, the locked legal details, the masked number and any open area change. */
    getProfile: () => request<ProfileView>('GET', '/v1/profile'),
    /** Display name and gender only; an empty display name greets by the legal name again. */
    updateProfile: (input: ProfileUpdateInput) => request<ProfileView>('PATCH', '/v1/profile', input),
    /** P04: every receipt, newest first. */
    listMyActivity: (filters: { kind?: ActivityKind; limit?: number } = {}) =>
      request<ActivityItem[]>('GET', `/v1/profile/activity${toEventQuery(filters)}`),
    getSurveyAnswers: () => request<Record<string, string>>('GET', '/v1/profile/survey-answers'),
    replaceSurveyAnswers: (answers: Record<string, string>) =>
      request<Record<string, string>>('PUT', '/v1/profile/survey-answers', { answers }),
    /** "Delete my optional answers": immediate, and logged. */
    deleteSurveyAnswers: () => request<void>('DELETE', '/v1/profile/survey-answers'),
    getIdentityDataNotice: () => request<IdentityDataItem[]>('GET', '/v1/profile/identity-data'),
    /**
     * A new password, only with the current one. Every session ends, this one too: sign in again.
     * Throws ApiError "wrong_password" (401), "password_refused" (422) or "too_many_requests" (429).
     */
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>('POST', '/v1/auth/password', { currentPassword, newPassword }),

    /** Ask to move to another GN division. Throws ApiError "request_open", "same_area" or "unknown_area" (409). */
    requestAreaChange: (gnCode: string) => request<AreaChange>('POST', '/v1/profile/area-changes', { gnCode }),
    listMyAreaChanges: () => request<AreaChange[]>('GET', '/v1/profile/area-changes/mine'),
    /** Proof of residence (kept encrypted); this sends the request for review. */
    uploadAreaChangeProof: (changeId: string, image: Blob | ArrayBuffer, contentType: IdentityImageType) =>
      request<AreaChange>('PUT', `/v1/profile/area-changes/${encodeURIComponent(changeId)}/proof`, image, contentType),
    withdrawAreaChange: (changeId: string) =>
      request<AreaChange>('POST', `/v1/profile/area-changes/${encodeURIComponent(changeId)}/withdraw`),
    /** Requests to move into the caller's areas. Needs members.verify. */
    /** The proof of residence, for a reviewer over the requested area; send the session with it. */
    areaChangeProofUrl: (changeId: string) => `${root}/v1/profile/area-changes/${encodeURIComponent(changeId)}/proof`,
    listAreaChanges: (filters: { states?: readonly AreaChange['state'][]; limit?: number } = {}) =>
      request<QueuedAreaChange[]>('GET', `/v1/profile/area-changes${toQueueQuery(filters)}`),
    /** Approve (the member's area changes now) or decline, with a reason. */
    decideAreaChange: (changeId: string, input: AreaDecisionInput) =>
      request<AreaChange>('POST', `/v1/profile/area-changes/${encodeURIComponent(changeId)}/decision`, input),

    /** The one-time code that confirms closing the account. Throws ApiError "no_recovery_number" (409). */
    sendClosureCode: () => request<CodeSent>('POST', '/v1/privacy/closure-code'),
    /**
     * A copy of one's data, or closing the account (with password and code): a receipt with its due date.
     * Throws ApiError "wrong_password", "invalid_code" or "too_many_attempts" (401) for a closure.
     */
    makePrivacyRequest: (input: PrivacyRequestInput) => request<PrivacyRequest>('POST', '/v1/privacy/requests', input),
    listMyPrivacyRequests: () => request<PrivacyRequest[]>('GET', '/v1/privacy/requests/mine'),
    /** The DPO register, soonest due first. Needs privacy.requests.handle. */
    listPrivacyRegister: (filters: { states?: readonly PrivacyRequest['state'][]; limit?: number } = {}) =>
      request<PrivacyRegisterEntry[]>('GET', `/v1/privacy/requests${toQueueQuery(filters)}`),
    /** Complete or refuse with a note; completing a closure closes the account. */
    closePrivacyRequest: (requestId: string, input: PrivacyOutcomeInput) =>
      request<PrivacyRegisterEntry>('POST', `/v1/privacy/requests/${encodeURIComponent(requestId)}/decision`, input),

    /**
     * H03: All or Action needed, newest first, with unread and action-needed counts. Each item names what it
     * opens (targetKind, targetId); reading never clears Action needed.
     */
    getNotifications: (
      filters: { view?: 'all' | 'action_needed'; topic?: NotificationTopic; before?: string; limit?: number } = {},
    ) => request<NotificationInbox>('GET', `/v1/notifications${toEventQuery(filters)}`),
    markNotificationRead: (notificationId: string) =>
      request<void>('POST', `/v1/notifications/${encodeURIComponent(notificationId)}/read`),
    markAllNotificationsRead: () => request<void>('POST', '/v1/notifications/read-all'),
    /** P05: push and SMS per topic, and quiet hours. */
    getNotificationChoices: () => request<NotificationChoices>('GET', '/v1/notifications/choices'),
    /** Throws ApiError "topic_locked" (409) for turning off account or review notices. */
    updateNotificationChoices: (input: NotificationChoicesInput) =>
      request<NotificationChoices>('PUT', '/v1/notifications/choices', input),
    /** After sign-in: the app's push token. */
    registerPushDevice: (token: string, platform: PushPlatform) =>
      request<void>('POST', '/v1/notifications/devices', { token, platform }),
    /** On sign-out, before the session ends. */
    unregisterPushDevice: (token: string) => request<void>('POST', '/v1/notifications/devices/unregister', { token }),

    /** Broadcasts in the caller's areas. Needs notifications.send. */
    listBroadcasts: (filters: { states?: readonly Broadcast['state'][]; limit?: number; offset?: number } = {}) =>
      request<Broadcast[]>('GET', `/v1/notifications/broadcasts${toQueueQuery(filters)}`),
    estimateBroadcastReach: (area: AreaRef, audienceTiers?: readonly StaffTier[]) =>
      request<AudienceReach>('POST', '/v1/notifications/broadcasts/reach', {
        area,
        audienceTiers: audienceTiers?.length ? audienceTiers : null,
      }),
    /** A bilingual draft for an area in the caller's own scope; another area is "outside_your_area" (403). */
    createBroadcast: (input: BroadcastCreateInput) => request<Broadcast>('POST', '/v1/notifications/broadcasts', input),
    updateBroadcast: (broadcastId: string, input: BroadcastUpdateInput) =>
      request<Broadcast>('PATCH', `/v1/notifications/broadcasts/${encodeURIComponent(broadcastId)}`, input),
    /** How many members it reaches, and anything that would stop it (e.g. "contains_id_number"). */
    previewBroadcast: (broadcastId: string) =>
      request<BroadcastPreview>('POST', `/v1/notifications/broadcasts/${encodeURIComponent(broadcastId)}/preview`),
    /** Now, or at sendAt; wider than a district it waits for approval. */
    submitBroadcast: (broadcastId: string, sendAt?: string) =>
      request<Broadcast>('POST', `/v1/notifications/broadcasts/${encodeURIComponent(broadcastId)}/submit`, { sendAt }),
    /** By a Tier 4 or 5 holder over the area who did not submit it. */
    approveBroadcast: (broadcastId: string) =>
      request<Broadcast>('POST', `/v1/notifications/broadcasts/${encodeURIComponent(broadcastId)}/approve`),
    cancelBroadcast: (broadcastId: string) =>
      request<Broadcast>('POST', `/v1/notifications/broadcasts/${encodeURIComponent(broadcastId)}/cancel`),

    /** The v1.1 modules that are on; the apps show only these (FR-ARCH-011). No sign-in needed. */
    getEnabledFeatures: () => request<EnabledFeatures>('GET', '/v1/features'),
    /** Every v1.1 module, the gate it needs and what is recorded. Needs system.configure. */
    getFeatureRegistry: () => request<FeatureFlag[]>('GET', '/v1/features/registry'),
    recordFeatureGate: (key: string, gate: PhaseGate, approvalRef: string, reason: string) =>
      request<FeatureFlag>('POST', `/v1/features/${encodeURIComponent(key)}/gate`, { gate, approvalRef, reason }),
    /** Refused with gate_not_recorded until the gate is recorded. */
    enableFeature: (key: string, reason: string) =>
      request<FeatureFlag>('POST', `/v1/features/${encodeURIComponent(key)}/enable`, { reason }),
    disableFeature: (key: string, reason: string) =>
      request<FeatureFlag>('POST', `/v1/features/${encodeURIComponent(key)}/disable`, { reason }),

    /** Elections running for the member's area, with the official source and labelled notices (FR-ELX-001, 004). */
    getCurrentElections: () => request<ElectionBanner[]>('GET', '/v1/election/current'),
    /** Declared periods by default. Needs election.mode.manage. */
    listElectionPeriods: (filters: { states?: readonly ElectionPeriodState[]; limit?: number } = {}) =>
      request<ElectionPeriod[]>('GET', `/v1/election/periods${toQueueQuery(filters)}`),
    /** Overlapping periods are allowed and listed in `overlaps` as a warning. */
    declareElectionPeriod: (input: ElectionPeriodInput) =>
      request<DeclaredElectionPeriod>('POST', '/v1/election/periods', input),
    getElectionPeriod: (periodId: string) =>
      request<ElectionPeriodFile>('GET', `/v1/election/periods/${encodeURIComponent(periodId)}`),
    closeElectionPeriod: (periodId: string, action: 'end' | 'withdraw', reason: string) =>
      request<ElectionPeriod>('POST', `/v1/election/periods/${encodeURIComponent(periodId)}/close`, { action, reason }),
    publishElectionNotice: (periodId: string, input: ElectionNoticeInput) =>
      request<ElectionNotice>('POST', `/v1/election/periods/${encodeURIComponent(periodId)}/notices`, input),
    withdrawElectionNotice: (noticeId: string) =>
      request<ElectionNotice>('POST', `/v1/election/notices/${encodeURIComponent(noticeId)}/withdraw`),
    // Household endpoints (Phase 2.5a SC-22)
    getMyHousehold: () => request<Household | null>('GET', '/v1/households/mine'),
    createHousehold: (body: HouseholdCreateInput) => request<Household>('POST', '/v1/households', body),
    updateHousehold: (body: HouseholdUpdateInput) => request<Household>('PATCH', '/v1/households/mine', body),
    getMyInvitations: () => request<InvitationsList>('GET', '/v1/households/invitations/mine'),
    inviteAdult: (body: InviteAdultInput) => request<HouseholdInvitation>('POST', '/v1/households/invitations', body),
    respondInvitation: (invitationId: string, body: InvitationRespondInput) =>
      request<Household | null>('POST', `/v1/households/invitations/${encodeURIComponent(invitationId)}/respond`, body),
    revokeInvitation: (invitationId: string) =>
      request<void>('POST', `/v1/households/invitations/${encodeURIComponent(invitationId)}/revoke`),
    removeHouseholdMember: (memberRecordId: string) =>
      request<void>('POST', `/v1/households/members/${encodeURIComponent(memberRecordId)}/remove`),
    leaveHousehold: () => request<void>('POST', '/v1/households/leave'),
    getHouseholdPrivacyNotice: () => request<ConsentNotice>('GET', '/v1/households/privacy'),
    staffViewHousehold: (targetMemberId: string) =>
      request<StaffHouseholdView>('GET', `/v1/households/staff/${encodeURIComponent(targetMemberId)}`),
    /** Lightweight community report counts grouped by state for area-scoped queues. Needs reports.view. */
    getCommunityReportCounts: () => request<CommunityReportsQueueCount>('GET', '/v1/community/reports/counts'),
    /** Bounded paginated list of area-scoped community reports. Needs reports.view. */
    listCommunityReports: (params?: { status?: CommunityReportStatus; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.limit !== undefined) q.set('limit', String(params.limit));
      if (params?.offset !== undefined) q.set('offset', String(params.offset));
      const qs = q.toString();
      return request<CommunityReportList>('GET', `/v1/community/reports${qs ? `?${qs}` : ''}`);
    },
    /** Area-scoped operational detail without reporter identity or contact data. Needs reports.view. */
    getCommunityReport: (reportId: string) =>
      request<CommunityReportSummary>('GET', `/v1/community/reports/${encodeURIComponent(reportId)}`),
    // Community Finance endpoints (Milestone 1.4)
    getFundConfig: () => request<FundConfig>('GET', '/v1/fund/config'),
    createContribution: (body: ContributionCreateInput, idempotencyKey?: string) =>
      request<ContributionDetail>(
        'POST',
        '/v1/fund/contributions',
        { currency: 'LKR', declarationVersion: 'v1', ...body },
        undefined,
        idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      ),
    uploadContributionSlip: (
      id: string,
      image: Blob | ArrayBuffer | Uint8Array,
      contentType: 'image/jpeg' | 'image/png' = 'image/jpeg',
    ) =>
      request<void>('PUT', `/v1/fund/contributions/${encodeURIComponent(id)}/slip`, image, contentType),
    submitContribution: (id: string) =>
      request<ContributionDetail>('POST', `/v1/fund/contributions/${encodeURIComponent(id)}/submit`),
    getMyContributions: (limit?: number, offset?: number) => {
      const q = new URLSearchParams();
      if (limit !== undefined) q.set('limit', String(limit));
      if (offset !== undefined) q.set('offset', String(offset));
      const qs = q.toString();
      return request<ContributionDetail[]>('GET', `/v1/fund/contributions/mine${qs ? `?${qs}` : ''}`);
    },
    getMyContribution: (id: string) =>
      request<ContributionDetail>('GET', `/v1/fund/contributions/${encodeURIComponent(id)}`),
    getMyContributionReceipt: (id: string) =>
      request<ContributionReceipt>('GET', `/v1/fund/contributions/${encodeURIComponent(id)}/receipt`),

    // Staff Finance Operations
    listFinanceContributions: (filters: FinanceContributionFilters = {}) => {
      const q = new URLSearchParams();
      if (filters.status) q.set('status', filters.status);
      if (filters.month) q.set('month', filters.month);
      if (filters.riskFlag) q.set('risk_flag', filters.riskFlag);
      if (filters.reference) q.set('reference', filters.reference);
      if (filters.mine) q.set('mine', 'true');
      if (filters.limit !== undefined) q.set('limit', String(filters.limit));
      if (filters.offset !== undefined) q.set('offset', String(filters.offset));
      const qs = q.toString();
      return request<StaffContributionsList>('GET', `/v1/finance/contributions${qs ? `?${qs}` : ''}`);
    },
    getFinanceContribution: (id: string) =>
      request<StaffContributionDetail>('GET', `/v1/finance/contributions/${encodeURIComponent(id)}`),
    claimFinanceContribution: (id: string) =>
      request<void>('POST', `/v1/finance/contributions/${encodeURIComponent(id)}/claim`),
    getFinanceSlipViewToken: (id: string) =>
      request<StaffSlipViewToken>('POST', `/v1/finance/contributions/${encodeURIComponent(id)}/slip-view`),
    financeSlipUrl: (token: string) => `${root}/v1/finance/slips/${encodeURIComponent(token)}`,
    reconcileFinanceContribution: (id: string, body: StaffReconcileInput) =>
      request<void>('POST', `/v1/finance/contributions/${encodeURIComponent(id)}/reconcile`, body),
    approveFinanceContribution: (id: string, body: StaffApproveInput) =>
      request<ContributionReceipt | null>('POST', `/v1/finance/contributions/${encodeURIComponent(id)}/approve`, body),
    exportFinanceLedgerCsv: async (month: string): Promise<string> => {
      const q = new URLSearchParams({ month });
      const response = await send('GET', `/v1/finance/ledger.csv?${q.toString()}`, await getToken?.(), undefined, undefined, {
        Accept: 'text/csv',
      });
      if (!response.ok) throw await toApiError(response);
      return response.text();
    },
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
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toQueueQuery(filters: { states?: readonly string[]; mine?: boolean; limit?: number; offset?: number }): string {
  const params = new URLSearchParams();
  for (const state of filters.states ?? []) params.append('state', state);
  if (filters.mine) params.set('mine', 'true');
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toEventQuery(filters: Record<string, string | number | undefined>): string {
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
