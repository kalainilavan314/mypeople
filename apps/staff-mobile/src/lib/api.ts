import { createApiClient } from '@my-people/api-client';

// The public API address, built into the app at build time (see .env.example).
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const api = API_URL ? createApiClient({ baseUrl: API_URL }) : null;

/**
 * Resolves true when the API answers its health check and throws when it
 * cannot be reached. Null when no API address is configured, so the screen
 * can say so instead of failing silently.
 */
export const apiHealthCheck = api ? async () => (await api.checkHealth()).status === 'ok' : null;
