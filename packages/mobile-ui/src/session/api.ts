import { createApiClient, type ApiClient } from '@my-people/api-client';

import { readToken } from '../lib/storage';

let client: ApiClient | null = null;

/** Builds the client once the install's device id is known; the session provider calls this. */
export function configureApi(baseUrl: string, deviceId: string | undefined): ApiClient {
  client = createApiClient({ baseUrl, getToken: readToken, deviceId });
  return client;
}

/** The configured client; screens only run after the session provider has configured it. */
export function api(): ApiClient {
  if (!client) throw new Error('The API address is not configured (EXPO_PUBLIC_API_URL).');
  return client;
}
