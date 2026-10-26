import { createApiClient, type ApiClient } from '@my-people/api-client';

import { readToken } from './storage';

// The public API address, built into the app at build time (see .env.example).
const API_URL = process.env.EXPO_PUBLIC_API_URL;

let client: ApiClient | null = null;

/** Builds the client once the install's device id is known. Null when no API address is configured. */
export function configureApi(deviceId: string | undefined): ApiClient | null {
  if (!API_URL) return null;
  client = createApiClient({ baseUrl: API_URL, getToken: readToken, deviceId });
  return client;
}

/** The configured client; screens only run after the root layout has configured it. */
export function api(): ApiClient {
  if (!client) throw new Error('The API address is not configured (EXPO_PUBLIC_API_URL).');
  return client;
}

export const apiConfigured = Boolean(API_URL);
