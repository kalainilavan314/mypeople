// Typed functions for the My People API (/v1), used by the Expo apps and the
// Next.js dashboard.
//
// The types come from the API's OpenAPI document. src/schema.ts is generated
// (npm run generate) and must not be edited by hand; after an API change,
// re-export openapi.json and regenerate it, and CI checks that you did.
import type { components } from './schema';

export type HealthStatus = components['schemas']['HealthStatus'];
export type MemberProfile = components['schemas']['MemberProfile'];
export type SignInResponse = components['schemas']['SignInResponse'];

/** A response other than 2xx. `code` is the API's error code, e.g. "invalid_credentials". */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Seconds to wait before trying again, when the API sent Retry-After (sign-in lockout). */
  readonly retryAfter: number | null;

  constructor(status: number, code: string, retryAfter: number | null) {
    super(`API request failed: ${status} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
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

export function createApiClient({ baseUrl, getToken, fetch: fetchImpl = globalThis.fetch }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = await getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfter = Number(response.headers.get('retry-after'));
  let code = `http_${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') code = body.detail;
    else if (Array.isArray(body.detail)) code = 'invalid_request'; // FastAPI field validation
  } catch {
    // Not JSON (e.g. a proxy error page); keep the HTTP status as the code.
  }
  return new ApiError(response.status, code, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
}
